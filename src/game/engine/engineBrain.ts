import { AICharacter } from '../../types/aiProgression';
import { ChessLogic } from '../../lib/chess-logic';
import { EngineResult, IEngineAdapter } from './types';
import { RustEngineAdapter } from './adapters/rustEngineAdapter';
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
        adapter = new RustEngineAdapter('nnue');
        break;
      case 'stockfish_benchmark':
        adapter = new StockfishBenchmarkAdapter();
        break;
      case 'hce':
      default:
        adapter = new RustEngineAdapter('hce');
        break;
    }
    if (import.meta.env.DEV) {
      console.debug(`[EngineBrain] Routing ${character.tier} bot '${character.id}' -> ${engineType} engine`);
      if (engineType === 'nnue' && character.errorNoiseCp === 0) {
        console.debug(`[EngineBrain] Routing Grandmaster bot '${character.id}' with ZERO errorNoiseCp`);
      }
    }

    return new EngineBrain(character, chess, adapter);
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
        throw new Error("Primary engine returned no move");
      }
      return result;
    } catch (err) {
      if (err instanceof Error && err.message === 'AbortError') throw err;
      
      console.warn("Primary engine failed or returned no move. Playing first legal move as emergency fallback.", err);
      const moves = this.chess.getAllLegalMoves();
      if (moves.length === 0) {
        return { move: null, engineUsed: 'hce', thinkTimeMs: 0, searchDepth: 0, evalCp: 0, noiseApplied: 0, wasFallback: true };
      }
      return {
        move: { from: moves[0].from, to: moves[0].to, promotion: moves[0].promotion },
        engineUsed: 'hce',
        thinkTimeMs: 0,
        searchDepth: 1,
        evalCp: 0,
        noiseApplied: 0,
        wasFallback: true
      };
    }
  }

  cancel(): void {
    this.adapter.cancel();
  }

  dispose(): void {
    this.adapter.dispose();
  }
}
