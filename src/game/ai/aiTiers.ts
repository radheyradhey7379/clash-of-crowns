import { AITier } from '../../types/aiProgression';

export interface TierConfig {
  minElo: number;
  maxElo: number | null;
}

export const AI_TIERS: Record<AITier, TierConfig> = {
  beginner: { minElo: 0, maxElo: 299 },
  learner: { minElo: 300, maxElo: 549 },
  intermediate: { minElo: 550, maxElo: 849 },
  hard: { minElo: 850, maxElo: 1149 },
  master: { minElo: 1150, maxElo: 1449 },
  grandmaster: { minElo: 1450, maxElo: null },
};
