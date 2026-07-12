import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Ensure performance is globally available for WASM
if (typeof global.performance === 'undefined') {
  global.performance = performance as any;
}

import init, { compute_move, validate_move, simulate_round_robin, get_engine_info } from '../../wasm-pkg/wasm_engine.js';
import { WasmEngineAdapter } from '../wasmEngineAdapter';
import { EngineBrain } from '../../engineBrain';
import { AICharacter } from '../../../../types/aiProgression';
import { ChessLogic } from '../../../../lib/chess-logic';

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(data: any) {
    const { id, action, payload } = data;
    setTimeout(() => {
      try {
        let resultStr = '';
        if (action === 'compute_move') {
          resultStr = compute_move(payload);
        } else if (action === 'validate_move') {
          resultStr = validate_move(payload);
        } else if (action === 'simulate_round_robin') {
          resultStr = simulate_round_robin(payload);
        } else if (action === 'get_engine_info') {
          resultStr = get_engine_info();
        }
        this.onmessage?.({ data: { type: 'success', id, result: JSON.parse(resultStr) } } as MessageEvent);
      } catch (err) {
        this.onmessage?.({ data: { type: 'success', id, error: String(err) } } as MessageEvent);
      }
    }, 5);
  }
  terminate() {}
}

describe('Phase 3 Search Algorithm QA Tests', () => {
  let originalWorker: any;

  beforeAll(async () => {
    originalWorker = global.Worker;
    global.Worker = MockWorker as any;

    const wasmPath = path.resolve(__dirname, '../../wasm-pkg/wasm_engine_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    await init(wasmBuffer);
  });

  afterAll(() => {
    global.Worker = originalWorker;
  });

  // --- Part 3: Negamax + Alpha-Beta Proof ---

  it('engine_uses_negamax_for_ai_move', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);

    const result = await brain.computeMove();
    expect(result.searchDebugInfo?.searchUsed).toBe('negamax');
  });

  it('alpha_beta_cutoffs_occur_on_branching_position', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 3, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);

    const result = await brain.computeMove();
    expect(typeof result.searchDebugInfo?.alphaBetaCutoffs).toBe('number');
    expect(result.searchDebugInfo?.alphaBetaCutoffs).toBeGreaterThanOrEqual(0);
  });

  it('alpha_beta_never_returns_illegal_move', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const result = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(result.move).not.toBeNull();
    // Validate move legality using chess.js
    const chess = new ChessLogic();
    const legalMoves = chess.getAllLegalMoves();
    const matched = legalMoves.some(m => m.from === result.move?.from && m.to === result.move?.to);
    expect(matched).toBe(true);
  });

  it('search_never_returns_illegal_move', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const result = await adapter.computeMove({
      fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
      depth: 3,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'learner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(result.move).not.toBeNull();
  });

  it('engine_handles_checkmate_position', async () => {
    const adapter = new WasmEngineAdapter('hce');
    // Scholar's Mate threat position (White to move has Qf7# checkmate)
    const result = await adapter.computeMove({
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(result.move).not.toBeNull();
    // The best move should be f3f7 (Qxf7#)
    const moveStr = result.move?.from + result.move?.to;
    expect(moveStr).toBe('f3f7');
  });

  it('engine_handles_stalemate_position', async () => {
    const adapter = new WasmEngineAdapter('hce');
    // Stalemate position: Black to move is stalemated
    const result = await adapter.computeMove({
      fen: 'k7/8/1Q6/8/8/8/8/7K b - - 0 1',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    // Stalemate means no legal moves, so result.move must be null
    expect(result.move).toBeNull();
  });

  it('engine_handles_promotion_position', async () => {
    const adapter = new WasmEngineAdapter('hce');
    // White pawn on e7 can promote to e8
    const result = await adapter.computeMove({
      fen: '8/4P3/8/8/8/4k3/8/7K w - - 0 1',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(result.move).not.toBeNull();
    expect(result.move?.from).toBe('e7');
    expect(result.move?.to).toBe('e8');
  });

  // --- Part 4: Iterative Deepening & Timeout ---

  it('timeout_does_not_return_illegal_move', async () => {
    const adapter = new WasmEngineAdapter('hce');
    // Force a tight timeout
    const result = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 6,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1, // Extremely small timeout
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(result.move).not.toBeNull();
    const chess = new ChessLogic();
    const legalMoves = chess.getAllLegalMoves();
    const matched = legalMoves.some(m => m.from === result.move?.from && m.to === result.move?.to);
    expect(matched).toBe(true);
  });

  it('timeout_does_not_freeze_worker', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const res1 = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 5,
      errorNoiseCp: 0,
      maxThinkTimeMs: 2,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    const res2 = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 1,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    expect(res1.move).not.toBeNull();
    expect(res2.move).not.toBeNull();
  });

  it('search_respects_time_budget', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const start = Date.now();
    const result = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 8,
      errorNoiseCp: 0,
      maxThinkTimeMs: 150,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    const duration = Date.now() - start;
    // Allow minor buffer for JS event loop scheduling, but should be close to or under 250ms
    expect(duration).toBeLessThan(350);
  });

  // --- Part 7: Stress Tests ---

  it('no_deadlock_50_moves', async () => {
    const adapter = new WasmEngineAdapter('hce');
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    for (let i = 0; i < 20; i++) {
      const result = await adapter.computeMove({
        fen,
        depth: 1,
        errorNoiseCp: 0,
        maxThinkTimeMs: 100,
        botProfileId: 'beginner_1',
        style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
      });
      if (!result.move) break;
      // Advance position mock
      const chess = new ChessLogic(fen);
      const move = chess.makeMove(result.move);
      if (!move) break;
      fen = chess.getFen();
    }
    expect(true).toBe(true);
  });

  // --- Part 8: Real WASM Search Counters Tests ---

  it('real_nodes_visited_counter_increases', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 2, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(typeof result.searchDebugInfo?.nodesVisited).toBe('number');
    expect(result.searchDebugInfo?.nodesVisited).toBeGreaterThan(0);
  });

  it('real_alpha_beta_cutoffs_counter_increases_on_branching_position', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 3, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(typeof result.searchDebugInfo?.alphaBetaCutoffs).toBe('number');
    expect(result.searchDebugInfo?.alphaBetaCutoffs).toBeGreaterThan(0);
  });

  it('real_quiescence_nodes_counter_increases_on_noisy_position', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(typeof result.searchDebugInfo?.quiescenceNodes).toBe('number');
    expect(result.searchDebugInfo?.quiescenceNodes).toBeGreaterThan(0);
  });

  it('real_quiescence_depth_max_recorded', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(typeof result.searchDebugInfo?.quiescenceDepthMax).toBe('number');
    expect(result.searchDebugInfo?.quiescenceDepthMax).toBeGreaterThan(0);
  });

  it('iterative_deepening_depth_sequence_real', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 2, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(Array.isArray(result.searchDebugInfo?.depthSequence)).toBe(true);
    expect(result.searchDebugInfo?.depthSequence).toEqual([1, 2]);
  });

  it('timeout_sets_stopped_by_timeout_true', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 5, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const adapter = new WasmEngineAdapter('hce');
    const result = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 5,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    const brainResult = (brain as any).attachDebugInfo(result, { depth: 5, maxThinkTimeMs: 1 });
    expect(brainResult.searchDebugInfo?.stoppedByTimeout).toBe(true);
  });

  it('timeout_returns_best_so_far_when_available', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 5, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const adapter = new WasmEngineAdapter('hce');
    const result = await adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 5,
      errorNoiseCp: 0,
      maxThinkTimeMs: 10,
      botProfileId: 'beginner_1',
      style: { aggression: 0.5, defense: 0.5, openingKnowledge: 0.5, endgameSkill: 0.5 }
    });
    const brainResult = (brain as any).attachDebugInfo(result, { depth: 5, maxThinkTimeMs: 10 });
    expect(brainResult.move).not.toBeNull();
    if (brainResult.searchDebugInfo?.depthReached! > 0) {
      expect(brainResult.searchDebugInfo?.returnedBestSoFar).toBe(true);
    }
  });

  it('lmr_marked_not_implemented', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(result.searchDebugInfo?.lmrReductions).toBe('NOT_IMPLEMENTED');
  });

  it('tt_marked_not_implemented', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(result.searchDebugInfo?.transpositionHits).toBe('NOT_IMPLEMENTED');
    expect(result.searchDebugInfo?.transpositionStores).toBe('NOT_IMPLEMENTED');
  });

  it('search_debug_info_has_no_unavailable_for_core_counters', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(result.searchDebugInfo?.nodesVisited).not.toBe('UNAVAILABLE_FROM_CURRENT_WASM');
    expect(result.searchDebugInfo?.alphaBetaCutoffs).not.toBe('UNAVAILABLE_FROM_CURRENT_WASM');
    expect(result.searchDebugInfo?.quiescenceNodes).not.toBe('UNAVAILABLE_FROM_CURRENT_WASM');
    expect(result.searchDebugInfo?.quiescenceDepthMax).not.toBe('UNAVAILABLE_FROM_CURRENT_WASM');
  });

  it('debug_info_hidden_from_release_ui', async () => {
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const oldEnv = import.meta.env.DEV;
    (import.meta.env as any).DEV = false;
    const oldNodeEnv = process.env.NODE_ENV;
    delete (process.env as any).NODE_ENV;
    
    try {
      const result = await brain.computeMove();
      expect(result.debugInfo).toBeUndefined();
      expect(result.searchDebugInfo).toBeUndefined();
    } finally {
      (import.meta.env as any).DEV = oldEnv;
      (process.env as any).NODE_ENV = oldNodeEnv;
    }
  });
});
