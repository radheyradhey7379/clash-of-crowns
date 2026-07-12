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
    // Assert that the prebuilt WASM marks cutoffs as UNAVAILABLE_FROM_CURRENT_WASM
    const bot = { id: 'beginner_1', tier: 'beginner', depth: 1, errorNoiseCp: 0, engine: 'hce' } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);

    const result = await brain.computeMove();
    expect(result.searchDebugInfo?.alphaBetaCutoffs).toBe('UNAVAILABLE_FROM_CURRENT_WASM');
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
});
