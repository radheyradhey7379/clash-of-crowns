export type MoveClassification = 'brilliant' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedMove {
  fen: string;
  playedMove: string;         // SAN notation
  bestMoveUci: string;        // UCI from Stockfish (e.g. 'e2e4')
  bestMoveSan: string;        // SAN of best move (for display)
  evalCp: number;             // Centipawns from white's perspective AFTER this move
  prevEvalCp: number;         // Previous position eval
  cpl: number;                // Centipawn loss for this move
  classification: MoveClassification;
  comment: string;            // Generated analysis comment
  side: 'White' | 'Black';    // Who played this move
  moveNumber: number;
  isMateScore: boolean;       // true if eval is mate-in-N
  mateIn: number | null;      // mate distance if applicable
}

export interface GameAnalysis {
  moves: AnalyzedMove[];
  playerAccuracy: number;     // 0-100%
  opponentAccuracy: number;
  playerACPL: number;         // Average Centipawn Loss
  opponentACPL: number;
  opening: OpeningInfo | null;
  statistics: MoveStatistics;
  kingSafety: { white: number; black: number };  // 0-100 scale
  analyzedAt: number;         // timestamp
  analysisDepth: number;
}

export interface OpeningInfo {
  eco: string;                // e.g. 'C51'
  name: string;               // e.g. 'Evans Gambit'
  description: string;
}

export interface MoveStatistics {
  brilliant: number;
  best: number;
  excellent: number;
  good: number;
  inaccuracy: number;
  mistake: number;
  blunder: number;
}

export interface StockfishEvalResult {
  evalCp: number;             // centipawns from white's perspective
  bestMoveUci: string;        // UCI notation
  isMateScore: boolean;
  mateIn: number | null;      // positive = white mates, negative = black mates
  depth: number;
  pv: string[];               // principal variation
}

export interface AnalysisProgress {
  current: number;
  total: number;
  phase: 'initializing' | 'analyzing' | 'classifying' | 'complete';
}
