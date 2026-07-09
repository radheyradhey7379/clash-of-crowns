import { StockfishAnalysisService } from '../stockfish/stockfishAnalysisService';
import { classifyAndAnalyze } from './classifyMoves';
import { detectOpening } from './openingDatabase';
import { GameAnalysis, AnalysisProgress, StockfishEvalResult } from './analysisTypes';

export class AnalysisOrchestrator {
  private sfService: StockfishAnalysisService | null = null;
  private cancelled = false;

  async analyzeGame(
    history: { fen: string; move: string; side: string; moveNumber: number }[],
    playerColor: 'w' | 'b',
    depth = 12,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<GameAnalysis | null> {
    this.cancelled = false;
    this.sfService = new StockfishAnalysisService();

    try {
      const total = history.length;
      if (total === 0) {
        return null;
      }

      if (onProgress) {
        onProgress({ current: 0, total, phase: 'initializing' });
      }

      const evals: StockfishEvalResult[] = [];

      for (let i = 0; i < total; i++) {
        if (this.cancelled) {
          return null;
        }

        if (onProgress) {
          onProgress({ current: i + 1, total, phase: 'analyzing' });
        }

        const item = history[i];
        // Run analysis on each FEN. Lower depth for speed/efficiency, capped maxThinkTime.
        const res = await this.sfService.analyzePosition(item.fen, depth, 1500);
        evals.push(res);
      }

      if (this.cancelled) {
        return null;
      }

      if (onProgress) {
        onProgress({ current: total, total, phase: 'classifying' });
      }

      // Classify moves
      const analysisResult = classifyAndAnalyze(evals, history, playerColor);

      // Detect opening
      const fens = history.map(h => h.fen);
      const opening = detectOpening(fens);

      const gameAnalysis: GameAnalysis = {
        moves: analysisResult.moves,
        playerAccuracy: analysisResult.playerAccuracy,
        opponentAccuracy: analysisResult.opponentAccuracy,
        playerACPL: analysisResult.playerACPL,
        opponentACPL: analysisResult.opponentACPL,
        opening,
        statistics: analysisResult.statistics,
        kingSafety: analysisResult.kingSafety,
        analyzedAt: Date.now(),
        analysisDepth: depth
      };

      if (onProgress) {
        onProgress({ current: total, total, phase: 'complete' });
      }

      return gameAnalysis;
    } catch (e) {
      console.error('[AnalysisOrchestrator] Error during analysis:', e);
      return null;
    } finally {
      this.dispose();
    }
  }

  cancel(): void {
    this.cancelled = true;
    if (this.sfService) {
      this.sfService.terminate();
    }
  }

  dispose(): void {
    if (this.sfService) {
      this.sfService.dispose();
      this.sfService = null;
    }
  }
}

// Local storage helpers
const STORAGE_PREFIX = 'coc_analysis_';

export function saveAnalysisLocally(matchId: string, analysis: GameAnalysis): void {
  try {
    const data = JSON.stringify(analysis);
    localStorage.setItem(STORAGE_PREFIX + matchId, data);
  } catch (e) {
    console.error('[AnalysisOrchestrator] Error saving analysis locally:', e);
  }
}

export function loadAnalysisLocally(matchId: string): GameAnalysis | null {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + matchId);
    if (!data) return null;
    return JSON.parse(data) as GameAnalysis;
  } catch (e) {
    console.error('[AnalysisOrchestrator] Error loading analysis locally:', e);
    return null;
  }
}

export function deleteAnalysisLocally(matchId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + matchId);
  } catch (e) {
    console.error('[AnalysisOrchestrator] Error deleting analysis locally:', e);
  }
}

/**
 * Remove any analysis older than 24 hours from localStorage
 */
export function cleanupOldAnalysis(): void {
  try {
    const keys = Object.keys(localStorage);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const analysis = JSON.parse(data) as GameAnalysis;
            if (analysis.analyzedAt && now - analysis.analyzedAt > oneDayMs) {
              localStorage.removeItem(key);
            }
          } catch {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (e) {
    console.error('[AnalysisOrchestrator] Error cleaning up old analysis:', e);
  }
}
