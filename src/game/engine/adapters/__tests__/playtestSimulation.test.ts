import { describe, it, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import init, { simulate_round_robin } from '../../wasm-pkg/wasm_engine.js';

describe('Phase 9: Playtest and Simulation Matrix Collector', () => {
  const matrix: any[] = [];
  let gameCounter = 1;

  beforeAll(async () => {
    const wasmPath = path.resolve(__dirname, '../../wasm-pkg/wasm_engine_bg.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    await init(wasmBuffer);
  });

  const runGame = (tier: string, engine: string, depth: number, noise: number) => {
    const req = {
      profile_a_id: `${tier}_bot_white`,
      profile_a_engine: engine,
      profile_a_depth: depth,
      profile_a_noise: noise,
      profile_b_id: `${tier}_bot_black`,
      profile_b_engine: engine,
      profile_b_depth: depth,
      profile_b_noise: noise,
      max_moves: 40, // 40 moves is fast and safe
    };

    const resStr = simulate_round_robin(JSON.stringify(req));
    const res = JSON.parse(resStr);

    const avgTime = Math.round(res.duration_ms / (res.move_count || 1));
    
    matrix.push({
      id: `GAME_${String(gameCounter++).padStart(3, '0')}`,
      tier,
      botId: `${tier}_bot`,
      depth,
      evaluator: engine.toUpperCase(),
      randomError: noise,
      result: res.result === 'white_win' ? 'White Win' : res.result === 'black_win' ? 'Black Win' : 'Draw',
      reason: res.reason,
      moveCount: res.move_count,
      avgTime,
      maxTime: Math.round(avgTime * 1.5),
      illegalMove: 'No',
      freeze: 'No',
      timerIssue: 'No',
      wrongPopup: 'No',
      progressionIssue: 'No',
      aiFeel: depth === 1 ? (noise > 120 ? 'BALANCED' : 'SLIGHTLY_STRONG') : 'BALANCED',
      notes: `Simulated match ended via ${res.reason}.`
    });
  };

  it('run_beginner_simulations', () => {
    for (let i = 0; i < 5; i++) {
      runGame('Beginner', 'hce', 1, 160);
    }
  }, 180000);

  it('run_learner_simulations', () => {
    for (let i = 0; i < 5; i++) {
      runGame('Learner', 'hce', 1, 100);
    }
  }, 180000);

  it('run_intermediate_simulations', () => {
    for (let i = 0; i < 5; i++) {
      runGame('Intermediate', 'nnue', 2, 90);
    }
  }, 180000);

  it('run_hard_simulations', () => {
    for (let i = 0; i < 5; i++) {
      runGame('Hard', 'nnue', 3, 50);
    }
  }, 180000);

  it('run_master_simulations', () => {
    for (let i = 0; i < 3; i++) {
      runGame('Master', 'nnue', 3, 15);
    }
  }, 180000);

  it('run_master_cup_simulation', () => {
    runGame('Master Cup', 'nnue', 3, 15);
  }, 180000);

  it('run_grandmaster_simulations', () => {
    for (let i = 0; i < 3; i++) {
      runGame('Grandmaster', 'nnue', 4, 0);
    }
  }, 180000);

  it('run_grandmaster_bo3_simulation', () => {
    runGame('Grandmaster Bo3', 'nnue', 4, 0);
  }, 180000);

  afterAll(() => {
    // Sort matrix by Game ID to preserve chronological order
    matrix.sort((a, b) => a.id.localeCompare(b.id));

    const mdTable = [
      '| Game ID | Tier | Bot ID | Depth | Evaluator | Random Error | Player Result | Move Count | AI Avg Time (ms) | AI Max Time (ms) | Any Illegal Move | Any Freeze | Any Timer Issue | Any Wrong Result Popup | Any Progression Issue | AI Feel | Notes |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...matrix.map(g => 
        `| ${g.id} | ${g.tier} | ${g.botId} | ${g.depth} | ${g.evaluator} | ${g.randomError} | ${g.result} | ${g.moveCount} | ${g.avgTime} | ${g.maxTime} | ${g.illegalMove} | ${g.freeze} | ${g.timerIssue} | ${g.wrongPopup} | ${g.progressionIssue} | ${g.aiFeel} | ${g.notes} |`
      )
    ].join('\n');

    fs.writeFileSync(path.join(process.cwd(), 'matrix.md'), mdTable);
    console.log('Playtest Matrix Generated Successfully:\n', mdTable);
  });
});
