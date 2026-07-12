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

export interface EngineDebugInfo {
  tier: string;
  botId: string;
  botName: string;
  evaluatorUsed: 'hce' | 'nnue';
  searchUsed: 'negamax';
  depthTarget: number;
  depthReached: number;
  timeMs: number;
  nodes: number;
  alphaBetaCutoffs: number;
  quiescenceNodes: number;
  randomErrorCpApplied: number;
  rawEval: number;
  finalEval: number;
  selectedMove: string;
  wasmVersion: string;
  engineSource: 'wasm' | 'backend' | 'emergency';
}

export interface SearchDebugInfo {
  searchUsed: string;
  depthTarget: number;
  depthReached: number;
  depthSequence: number[] | 'UNAVAILABLE_FROM_CURRENT_WASM';
  nodesVisited: number | 'UNAVAILABLE_FROM_CURRENT_WASM';
  alphaBetaCutoffs: number | 'UNAVAILABLE_FROM_CURRENT_WASM';
  betaCutoffs: number | 'UNAVAILABLE_FROM_CURRENT_WASM';
  quiescenceNodes: number | 'UNAVAILABLE_FROM_CURRENT_WASM';
  quiescenceDepthMax: number | 'UNAVAILABLE_FROM_CURRENT_WASM';
  transpositionHits: number | 'NOT_IMPLEMENTED' | 'UNAVAILABLE_FROM_CURRENT_WASM';
  transpositionStores: number | 'NOT_IMPLEMENTED' | 'UNAVAILABLE_FROM_CURRENT_WASM';
  moveOrderingUsed: boolean;
  lmrReductions: number | 'NOT_IMPLEMENTED' | 'UNAVAILABLE_FROM_CURRENT_WASM';
  timeBudgetMs: number;
  actualTimeMs: number;
  stoppedByTimeout: boolean;
  returnedBestSoFar: boolean;
  selectedMove: string;
  evalScore: number;
}

export interface EngineResult {
  move: { from: string; to: string; promotion?: string } | null;
  engineUsed: EngineType;
  thinkTimeMs: number;
  searchDepth: number;
  evalCp: number; // Centipawn evaluation
  noiseApplied: number; // Actual noise added
  wasFallback: boolean;

  // Pre-release Bug 5 metadata
  move_uci?: string;
  source?: 'wasm' | 'backend' | 'emergency';
  depth_completed?: number;
  used_partial_result?: boolean;
  reason?: string;
  debugInfo?: EngineDebugInfo;
  searchDebugInfo?: SearchDebugInfo;
}

export interface IEngineAdapter {
  computeMove(request: EngineRequest): Promise<EngineResult>;
  cancel(): void;
  dispose(): void;
  isReady(): boolean;
}
