import { AITier } from '../../types/aiProgression';

export interface TierConfig {
  minElo: number;
  maxElo: number | null;
}

export const AI_TIERS: Record<AITier, TierConfig> = {
  core: { minElo: 0, maxElo: 300 },
  beginner: { minElo: 300, maxElo: 700 },
  learner: { minElo: 700, maxElo: 1000 },
  promotion_trial: { minElo: 1000, maxElo: 1100 },
  intermediate: { minElo: 1100, maxElo: 1500 },
  hard: { minElo: 1500, maxElo: 2000 },
  master: { minElo: 2000, maxElo: 2500 },
  grandmaster: { minElo: 2500, maxElo: null },
};
