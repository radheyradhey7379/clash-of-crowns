import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectOpening } from '../openingDatabase';
import { classifyAndAnalyze } from '../classifyMoves';
import { AnalysisOrchestrator, saveAnalysisLocally, loadAnalysisLocally } from '../analysisOrchestrator';

// Mocking window/localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Match Analysis Manual QA Simulation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Flow Simulation: Play match -> Finish -> Run Stockfish -> Verify all dynamic widgets', () => {
    // 1. Play & Finish Match History
    const history = [
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 2', move: 'Nf3', side: 'White' as const, moveNumber: 1 },
      { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3', move: 'Bc4', side: 'White' as const, moveNumber: 2 },
      { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 3', move: 'b4', side: 'White' as const, moveNumber: 3 }
    ];

    // 2. Open Review & Trigger Analysis
    const mockEvals = [
      { evalCp: 25, bestMoveUci: 'g1f3', isMateScore: false, mateIn: null, depth: 12, pv: [] },
      { evalCp: 35, bestMoveUci: 'f1c4', isMateScore: false, mateIn: null, depth: 12, pv: [] },
      { evalCp: -110, bestMoveUci: 'b2b4', isMateScore: false, mateIn: null, depth: 12, pv: [] }
    ];

    // 3. Confirm all widgets get calculated dynamically
    const analysis = classifyAndAnalyze(mockEvals, history, 'w');
    
    // Test Classification (blunder/mistake/brilliant)
    expect(analysis.moves.length).toBe(3);
    expect(analysis.moves[0].classification).toBeDefined();

    // Test Accuracy & ACPL
    expect(analysis.playerAccuracy).toBeGreaterThanOrEqual(0);
    expect(analysis.playerAccuracy).toBeLessThanOrEqual(100);
    expect(analysis.playerACPL).toBeGreaterThanOrEqual(0);

    // Test Opening Detection (Should detect Italian Game or Evans Gambit variant)
    const opening = detectOpening(history.map(h => h.fen));
    expect(opening).not.toBeNull();
    expect(opening?.name).toBe('Evans Gambit'); // Evans Gambit is detected because of the final FEN

    // Test King Safety Heuristic
    expect(analysis.kingSafety.white).toBeGreaterThan(0);
    expect(analysis.kingSafety.black).toBeGreaterThan(0);

    // 4. Test Offline Analysis
    // Verify that saving it locally stores it correctly in localStorage
    saveAnalysisLocally('qa-match-999', {
      ...analysis,
      opening,
      analyzedAt: Date.now(),
      analysisDepth: 12
    });

    const loaded = loadAnalysisLocally('qa-match-999');
    expect(loaded).not.toBeNull();
    expect(loaded?.opening?.name).toBe('Evans Gambit');
  });
});
