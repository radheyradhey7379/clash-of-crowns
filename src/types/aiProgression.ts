export type AITier = 'beginner' | 'learner' | 'intermediate' | 'hard' | 'master' | 'grandmaster';

export type AIStyle = 'defensive' | 'aggressive' | 'balanced' | 'tactical' | 'endgame';

export interface AICharacter {
  id: string;
  tier: AITier;
  level: number;
  cup?: 1 | 2 | 3;
  name: string;
  title: string;
  eloTarget: number;
  personality: string;
  style: AIStyle;
  engine: 'hce' | 'nnue' | 'stockfish_benchmark';
  depth: number;
  errorNoiseCp: number; // Centipawns of evaluation noise

  aggression: number; // 0 to 1
  defense: number; // 0 to 1
  openingKnowledge: number; // 0 to 1
  endgameSkill: number; // 0 to 1
  moveDelayMs?: number;
  maxThinkTimeMs?: number;
  introLine?: string;
  playerWinLine?: string;
  playerLossLine?: string;
  drawLine?: string;
  taunts?: string[];
  mood?: string;
  difficultyLabel?: string;
}

export interface AIProgress {
  tier: AITier;
  level: number;
  elo: number;
  consecutiveLosses: number;

  unlockedTiers: AITier[];
  lockedTiers: AITier[];

  promotionTrial: {
    unlocked: boolean;
    completed: boolean;
  };

  hard: {
    locked: boolean;
  };

  masterCup: {
    currentCup: 1 | 2 | 3;
    currentMatch: number; // 1 to 4
    winsInCup: number;
    lossesInCup: number;
    completedCups: number[];
  };

  grandmaster: {
    unlocked: boolean;
    bossDefeated: boolean;
    bossSeriesWins: number;
    bossSeriesLosses: number;
    seasonPoints: number;
  };

  claimedTierRewards?: AITier[];
  claimedCupRewards?: number[];
}

export interface AIMatchResult {
  characterId?: string;
  tier?: AITier;
  result?: 'win' | 'loss' | 'draw';
  reason?: 'checkmate' | 'resign' | 'timeout' | 'draw';
  eloBefore?: number;
  timestamp?: number;
  playerWon?: boolean;
  isDraw?: boolean;
  cupCleared?: boolean;
}
