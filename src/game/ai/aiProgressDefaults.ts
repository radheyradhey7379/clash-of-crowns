import { AIProgress } from '../../types/aiProgression';

export const DEFAULT_AI_PROGRESS: AIProgress = {
  tier: 'beginner',
  level: 1,
  elo: 300, // Start ELO at 300
  consecutiveLosses: 0,
  unlockedTiers: ['beginner'],
  lockedTiers: ['learner', 'intermediate', 'hard', 'master', 'grandmaster'],
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
