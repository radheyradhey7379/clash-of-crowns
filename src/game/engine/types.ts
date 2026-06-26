export type EngineType = 'hce' | 'nnue' | 'stockfish_benchmark';

export interface EngineStyle {
  aggression: number;
  defense: number;
  openingKnowledge: number;
  endgameSkill: number;
}

export interface EngineRequest {
  fen: string;
  depth: number;
  errorNoiseCp: number; // Centipawns of evaluation noise
  maxThinkTimeMs: number;
  style: EngineStyle;
  botProfileId: string;
  recentMoves?: string[];
  recentFens?: string[];
}

export interface EngineResult {
  move: { from: string; to: string; promotion?: string } | null;
  engineUsed: EngineType;
  thinkTimeMs: number;
  searchDepth: number;
  evalCp: number; // Centipawn evaluation
  noiseApplied: number; // Actual noise added
  wasFallback: boolean;
}

export interface IEngineAdapter {
  computeMove(request: EngineRequest): Promise<EngineResult>;
  cancel(): void;
  dispose(): void;
  isReady(): boolean;
}
