import { AICharacter } from '../../types/aiProgression';
import { ChessLogic } from '../../lib/chess-logic';
import { EngineResult, IEngineAdapter } from './types';
import { RustEngineAdapter } from './adapters/rustEngineAdapter';
import { WasmEngineAdapter } from './adapters/wasmEngineAdapter';
import { getEngineForCharacter } from './campaign/progressionRules';
import { resolveEngine, getBotProfile as resolveBotProfile } from './campaign/botProfiles';
import { Chess } from 'chess.js';

export class EngineBrain {
  private constructor(private character: AICharacter, private chess: ChessLogic, private adapter: IEngineAdapter) {
  }

  static create(character: AICharacter, chess: ChessLogic): EngineBrain {
    const engineType = getEngineForCharacter(character);
    let adapter: IEngineAdapter;
    
    switch (engineType) {
      case 'nnue':
        adapter = new WasmEngineAdapter('nnue');
        break;
      case 'hce':
      default:
        adapter = new WasmEngineAdapter('hce');
        break;
    }
    if (import.meta.env.DEV) {
      console.debug(`[EngineBrain] Routing ${character.tier} bot '${character.id}' -> local Wasm ${engineType} engine`);
      if (engineType === 'nnue' && character.errorNoiseCp === 0) {
        console.debug(`[EngineBrain] Routing Grandmaster bot '${character.id}' with ZERO errorNoiseCp`);
      }
    }

    return new EngineBrain(character, chess, adapter);
  }

  private attachDebugInfo(result: EngineResult, request: any): EngineResult {
    const isDevOrTest = !!(import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test'));
    if (!isDevOrTest) {
      delete result.hceDebugInfo;
      delete result.nnueDebugInfo;
      delete result.randomErrorDebugInfo;
      delete result.debugInfo;
      delete result.searchDebugInfo;
      return result;
    }

    const rawEval = result.evalCp - result.noiseApplied;
    const finalEval = result.evalCp;
    const selectedMoveStr = result.move ? (result.move.from + result.move.to + (result.move.promotion || '')) : '';

    const debugStats = (result as any).wasmDebugStats;
    if (debugStats) {
      result.searchDebugInfo = {
        searchUsed: 'negamax',
        depthTarget: debugStats.depth_target,
        depthReached: debugStats.depth_reached,
        depthSequence: debugStats.depth_sequence,
        nodesVisited: debugStats.nodes_visited,
        alphaBetaCutoffs: debugStats.alpha_beta_cutoffs,
        betaCutoffs: debugStats.beta_cutoffs,
        quiescenceNodes: debugStats.quiescence_nodes,
        quiescenceDepthMax: debugStats.quiescence_depth_max,
        transpositionHits: 'NOT_IMPLEMENTED',
        transpositionStores: 'NOT_IMPLEMENTED',
        moveOrderingUsed: debugStats.move_ordering_used,
        lmrReductions: 'NOT_IMPLEMENTED',
        timeBudgetMs: request.maxThinkTimeMs || 5000,
        actualTimeMs: debugStats.actual_time_ms,
        stoppedByTimeout: debugStats.stopped_by_timeout,
        returnedBestSoFar: debugStats.returned_best_so_far,
        selectedMove: selectedMoveStr,
        evalScore: result.evalCp
      };

      result.debugInfo = {
        tier: this.character.tier,
        botId: this.character.id,
        botName: this.character.name,
        evaluatorUsed: result.engineUsed === 'nnue' ? 'nnue' : 'hce',
        searchUsed: 'negamax',
        depthTarget: request.depth,
        depthReached: result.searchDepth,
        timeMs: result.thinkTimeMs,
        nodes: debugStats.nodes_visited,
        alphaBetaCutoffs: debugStats.alpha_beta_cutoffs,
        quiescenceNodes: debugStats.quiescence_nodes,
        randomErrorCpApplied: result.noiseApplied,
        rawEval,
        finalEval,
        selectedMove: selectedMoveStr,
        wasmVersion: '1.0.0',
        engineSource: result.source || 'wasm'
      };
    } else {
      result.debugInfo = {
        tier: this.character.tier,
        botId: this.character.id,
        botName: this.character.name,
        evaluatorUsed: result.engineUsed === 'nnue' ? 'nnue' : 'hce',
        searchUsed: 'negamax',
        depthTarget: request.depth,
        depthReached: result.searchDepth,
        timeMs: result.thinkTimeMs,
        nodes: (result as any).nodes || Math.pow(15, result.searchDepth) || 0,
        alphaBetaCutoffs: 0,
        quiescenceNodes: 0,
        randomErrorCpApplied: result.noiseApplied,
        rawEval,
        finalEval,
        selectedMove: selectedMoveStr,
        wasmVersion: '1.0.0',
        engineSource: result.source || 'wasm'
      };

      const depthSeq: number[] = [];
      for (let d = 1; d <= result.searchDepth; d++) {
        depthSeq.push(d);
      }

      result.searchDebugInfo = {
        searchUsed: 'negamax',
        depthTarget: request.depth,
        depthReached: result.searchDepth,
        depthSequence: depthSeq,
        nodesVisited: 'UNAVAILABLE_FROM_CURRENT_WASM',
        alphaBetaCutoffs: 'UNAVAILABLE_FROM_CURRENT_WASM',
        betaCutoffs: 'UNAVAILABLE_FROM_CURRENT_WASM',
        quiescenceNodes: 'UNAVAILABLE_FROM_CURRENT_WASM',
        quiescenceDepthMax: 'UNAVAILABLE_FROM_CURRENT_WASM',
        transpositionHits: 'UNAVAILABLE_FROM_CURRENT_WASM',
        transpositionStores: 'UNAVAILABLE_FROM_CURRENT_WASM',
        moveOrderingUsed: true,
        lmrReductions: 'UNAVAILABLE_FROM_CURRENT_WASM',
        timeBudgetMs: request.maxThinkTimeMs || 5000,
        actualTimeMs: result.thinkTimeMs,
        stoppedByTimeout: result.reason === 'timeout',
        returnedBestSoFar: result.reason === 'timeout' || result.wasFallback,
        selectedMove: selectedMoveStr,
        evalScore: result.evalCp
      };
    }

    console.debug("[EngineBrain DebugInfo]", result.debugInfo);
    console.debug("[EngineBrain SearchDebugInfo]", result.searchDebugInfo);
    return result;
  }

  async computeMove(): Promise<EngineResult> {
    const profile = resolveBotProfile(this.character);
    
    // Reconstruct the history of moves (in UCI format) and FENs
    const verboseHistory = this.chess.getHistory({ verbose: true }) as any[];
    const tempGame = new Chess();
    const recentFens: string[] = [tempGame.fen()];
    const recentMoves: string[] = [];

    for (const m of verboseHistory) {
      const uci = m.from + m.to + (m.promotion || "");
      recentMoves.push(uci);
      try {
        tempGame.move({ from: m.from, to: m.to, promotion: m.promotion });
        recentFens.push(tempGame.fen());
      } catch (e) {
        break;
      }
    }

    const request = {
      fen: this.chess.getFen(),
      depth: profile.depth,
      errorNoiseCp: profile.errorNoiseCp,
      maxThinkTimeMs: profile.maxThinkTimeMs,
      style: profile.style,
      botProfileId: profile.characterId,
      recentMoves,
      recentFens,
    };

    try {
      const result = await this.adapter.computeMove(request);
      if (!result || !result.move) {
        throw new Error("Primary Wasm engine returned no move");
      }
      return this.attachDebugInfo(result, request);
    } catch (err) {
      const errName = (err as any)?.name || (err as any)?.constructor?.name;
      const errMsg = (err as any)?.message || '';
      if (errName === 'AbortError' || errMsg === 'AbortError' || errMsg.includes('aborted') || errMsg.includes('abort')) throw err;
      
      // Fallback: If local Wasm fails, try online backend (RustEngineAdapter) as secondary
      if (this.adapter instanceof WasmEngineAdapter) {
        console.warn("Local Wasm engine failed, trying backend server as fallback...", err);
        try {
          const engineType = getEngineForCharacter(this.character);
          const backendAdapter = new RustEngineAdapter(engineType === 'nnue' ? 'nnue' : 'hce');
          const result = await backendAdapter.computeMove(request);
          if (result && result.move) {
            return this.attachDebugInfo(result, request);
          }
        } catch (backendErr) {
          console.error("Backend fallback also failed:", backendErr);
        }
      }

      console.warn("Primary engine failed or returned no move. Playing first legal move as emergency fallback.", err);
      const moves = this.chess.getAllLegalMoves();
      if (moves.length === 0) {
        const result: EngineResult = { 
          move: null, 
          engineUsed: 'hce', 
          thinkTimeMs: 0, 
          searchDepth: 0, 
          evalCp: 0, 
          noiseApplied: 0, 
          wasFallback: true,
          source: 'emergency',
          depth_completed: 0,
          used_partial_result: false,
          reason: 'no_legal_moves'
        };
        return this.attachDebugInfo(result, request);
      }
      const firstMove = moves[0];
      const move_uci = firstMove.from + firstMove.to + (firstMove.promotion || "");
      const result: EngineResult = {
        move: { from: firstMove.from, to: firstMove.to, promotion: firstMove.promotion },
        engineUsed: 'hce',
        thinkTimeMs: 0,
        searchDepth: 1,
        evalCp: 0,
        noiseApplied: 0,
        wasFallback: true,
        move_uci,
        source: 'emergency',
        depth_completed: 0,
        used_partial_result: false,
        reason: 'primary_and_fallback_failed'
      };
      return this.attachDebugInfo(result, request);
    }
  }

  cancel(): void {
    this.adapter.cancel();
  }

  dispose(): void {
    this.adapter.dispose();
  }
}
