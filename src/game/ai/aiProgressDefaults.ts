import { AIProgress } from '../../types/aiProgression';

export const DEFAULT_AI_PROGRESS: AIProgress = {
  tier: 'core',
  level: 1,
  elo: 100, // Start ELO at 100
  consecutiveLosses: 0,
  unlockedTiers: ['core'],
  lockedTiers: ['beginner', 'learner', 'promotion_trial', 'intermediate', 'hard', 'master', 'grandmaster'],
  promotionTrial: {
    unlocked: false,
    completed: false
  },
  hard: {
    locked: false
  },
  masterCup: {
    currentCup: 1,
    currentMatch: 1,
    winsInCup: 0,
    lossesInCup: 0,
    completedCups: []
  },
  grandmaster: {
    unlocked: false,
    bossDefeated: false,
    bossSeriesWins: 0,
    bossSeriesLosses: 0,
    seasonPoints: 0
  },
  claimedTierRewards: [],
  claimedCupRewards: []
};
