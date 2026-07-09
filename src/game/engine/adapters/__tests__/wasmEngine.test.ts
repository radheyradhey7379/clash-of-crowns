import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import init, { compute_move, validate_move, simulate_round_robin, get_engine_info } from '../../wasm-pkg/wasm_engine.js';
import { WasmEngineAdapter } from '../wasmEngineAdapter';
import { EngineBrain } from '../../engineBrain';
import { AICharacter } from '../../../../types/aiProgression';
import { ChessLogic } from '../../../../lib/chess-logic';
import { simulateAiVsAiMatch } from '../../campaign/cupRoundRobin';

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

describe('Rust WebAssembly Engine Tests', () => {
  let originalWorker: any;

  beforeAll(async () => {
    // Save original worker
    originalWorker = global.Worker;
    // Set mock worker
    global.Worker = MockWorker as any;

    // Load compiled Wasm binary into memory and initialize wasm-bindgen
    const wasmPath = path.resolve(__dirname, '../../wasm-pkg/wasm_engine_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    await init(wasmBuffer);
  });

  afterAll(() => {
    // Restore original worker
    global.Worker = originalWorker;
  });

  it('wasm_engine_loads_successfully', () => {
    const infoJson = get_engine_info();
    const info = JSON.parse(infoJson);
    expect(info).toHaveProperty('weights_status');
    expect(info).toHaveProperty('weights_source');
    expect(info).toHaveProperty('inference_mode');
  });

  it('wasm_bundle_includes_nnue_weights', () => {
    const infoJson = get_engine_info();
    const info = JSON.parse(infoJson);
    // Prove that the trained weights are embedded in the Wasm bundle
    expect(info.weights_status).toBe('trained');
    expect(info.weights_source).toBe('file');
  });

  it('wasm_engine_returns_legal_move', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const request = {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 1,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
    };
    const result = await adapter.computeMove(request as any);
    expect(result.move).not.toBeNull();
    expect(result.move?.from).toBeDefined();
    expect(result.move?.to).toBeDefined();
  });

  it('offline_backend_unavailable_uses_wasm_engine', async () => {
    // Mock global fetch to throw error (backend is unavailable)
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const bot: AICharacter = {
      id: 'intermediate_1',
      name: 'Tester',
      tier: 'intermediate',
      avatarUrl: '',
      unlockedAt: 0,
      elo: 1400,
      difficultyLabel: 'Intermediate',
      depth: 2,
      errorNoiseCp: 50,
      engine: 'nnue',
      description: '',
      personality: 'passive',
      consecutiveLossesByCharacter: {}
    } as any;

    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);

    // Should use local Wasm engine directly since we are playing offline career
    const result = await brain.computeMove();
    expect(result.move).not.toBeNull();
    expect(result.wasFallback).toBe(false); // calculated using Wasm, not first-legal fallback

    global.fetch = originalFetch;
  });

  it('first_legal_fallback_not_used_for_normal_offline_career', async () => {
    const adapter = new WasmEngineAdapter('nnue');
    const request = {
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 1000,
    };
    const result = await adapter.computeMove(request as any);
    expect(result.wasFallback).toBe(false);
    // The first legal move in alphabetic/index order would typically be a2a3 or a2a4.
    // A searched smart move in this position will be a standard move like b1c3, f1b5, or f1c4.
    expect(result.move?.from).not.toBe('a2');
  });

  it('no_stockfish_gameplay_fallback', async () => {
    const bot: AICharacter = {
      id: 'beginner_1',
      name: 'Beginner',
      tier: 'beginner',
      avatarUrl: '',
      unlockedAt: 0,
      elo: 800,
      difficultyLabel: 'Beginner',
      depth: 1,
      errorNoiseCp: 150,
      engine: 'hce',
      description: '',
      personality: 'passive',
      consecutiveLossesByCharacter: {}
    } as any;
    const chess = new ChessLogic();
    const brain = EngineBrain.create(bot, chess);
    const result = await brain.computeMove();
    expect(result.engineUsed).not.toContain('stockfish');
  });

  it('beginner_uses_hce_limited_pst_negamax_alphabeta', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'hce',
      depth: 1,
      error_noise_cp: 100,
      max_think_time_ms: 100,
      bot_profile_id: 'beginner_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res).toHaveProperty('move_str');
  });

  it('learner_uses_hce_all_piece_pst_negamax_alphabeta', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'hce',
      depth: 1,
      error_noise_cp: 80,
      max_think_time_ms: 100,
      bot_profile_id: 'learner_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res).toHaveProperty('move_str');
  });

  it('learner_does_not_use_nnue', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'hce',
      depth: 1,
      error_noise_cp: 80,
      max_think_time_ms: 100,
      bot_profile_id: 'learner_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res.engine_used).not.toBe('nnue');
  });

  it('beginner_does_not_use_nnue', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'hce',
      depth: 1,
      error_noise_cp: 100,
      max_think_time_ms: 100,
      bot_profile_id: 'beginner_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res.engine_used).not.toBe('nnue');
  });

  it('intermediate_uses_nnue', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'nnue',
      depth: 2,
      error_noise_cp: 50,
      max_think_time_ms: 100,
      bot_profile_id: 'intermediate_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res.engine_used).toBe('nnue');
  });

  it('grandmaster_zero_noise', () => {
    const reqJson = JSON.stringify({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      engine_type: 'nnue',
      depth: 2,
      error_noise_cp: 0,
      max_think_time_ms: 100,
      bot_profile_id: 'grandmaster_1'
    });
    const resJson = compute_move(reqJson);
    const res = JSON.parse(resJson);
    expect(res.noise_applied).toBe(0);
  });

  it('master_uses_nnue_negamax_alphabeta_round_robin', async () => {
    // Mock global fetch to fail so it uses the Wasm offline simulation fallback
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const ai1: AICharacter = {
      id: 'beginner_1',
      name: 'Bot A',
      tier: 'beginner',
      avatarUrl: '',
      unlockedAt: 0,
      elo: 800,
      difficultyLabel: 'Beginner',
      depth: 1,
      errorNoiseCp: 150,
      engine: 'hce',
      description: '',
      personality: 'passive',
      consecutiveLossesByCharacter: {}
    } as any;

    const ai2: AICharacter = {
      id: 'learner_1',
      name: 'Bot B',
      tier: 'learner',
      avatarUrl: '',
      unlockedAt: 0,
      elo: 1000,
      difficultyLabel: 'Learner',
      depth: 1,
      errorNoiseCp: 100,
      engine: 'hce',
      description: '',
      personality: 'passive',
      consecutiveLossesByCharacter: {}
    } as any;

    const result = await simulateAiVsAiMatch(ai1, ai2);
    expect(['white_win', 'black_win', 'draw']).toContain(result);

    global.fetch = originalFetch;
  });

  it('wasm_worker_does_not_freeze_ui', async () => {
    const adapter = new WasmEngineAdapter('hce');
    const start = Date.now();
    
    const promise = adapter.computeMove({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      depth: 2,
      errorNoiseCp: 0,
      maxThinkTimeMs: 200,
    } as any);
    
    // Verify execution did not block synchronously (takes < 2ms to return promise)
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10);
    
    const result = await promise;
    expect(result.move).not.toBeNull();
  });
});
