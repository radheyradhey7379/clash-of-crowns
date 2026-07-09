/**
 * Elo System Configuration for Phase 13
 * Maps the 45 chess characters in the 3 UI tabs to ELO ratings and AI depths
 */

export interface LevelConfig {
  elo: number;
  depth: number;
}

export const ELO_MAPPING: LevelConfig[][] = [
  // BEGINNER Tab (10 characters: Beginner 1-5, Learner 1-5)
  [
    { elo: 100, depth: 1 }, { elo: 130, depth: 1 }, { elo: 160, depth: 2 }, { elo: 200, depth: 2 }, { elo: 240, depth: 2 }, // Beginner
    { elo: 300, depth: 2 }, { elo: 340, depth: 2 }, { elo: 380, depth: 3 }, { elo: 420, depth: 3 }, { elo: 460, depth: 4 }, // Learner
  ],
  // INTERMEDIATE Tab (16 characters: Intermediate 1-8, Hard 1-8)
  [
    { elo: 550, depth: 3 }, { elo: 580, depth: 3 }, { elo: 610, depth: 4 }, { elo: 640, depth: 4 },
    { elo: 670, depth: 4 }, { elo: 700, depth: 5 }, { elo: 730, depth: 5 }, { elo: 760, depth: 5 }, // Intermediate
    { elo: 850, depth: 5 }, { elo: 880, depth: 6 }, { elo: 910, depth: 6 }, { elo: 940, depth: 6 },
    { elo: 970, depth: 7 }, { elo: 1000, depth: 7 }, { elo: 1030, depth: 7 }, { elo: 1060, depth: 7 }, // Hard
  ],
  // GRANDMASTER Tab (12 characters: Master Cups 1-3 [9], Grandmaster Boss, Daily, Seasonal)
  [
    { elo: 1150, depth: 8 }, { elo: 1180, depth: 8 }, { elo: 1210, depth: 8 }, // Cup 1
    { elo: 1240, depth: 9 }, { elo: 1270, depth: 9 }, { elo: 1300, depth: 9 }, // Cup 2
    { elo: 1330, depth: 10 }, { elo: 1360, depth: 10 }, { elo: 1400, depth: 10 }, // Cup 3
    { elo: 1450, depth: 12 }, { elo: 1520, depth: 14 }, { elo: 1600, depth: 16 }, // Grandmaster
  ]
];

/**
 * Gets the AI depth for a specific tier and character index
 */
export function getAIDepth(tier: number, charIdx: number): number {
  const tierConfig = ELO_MAPPING[tier];
  if (!tierConfig) return 1;
  const levelConfig = tierConfig[charIdx] || tierConfig[tierConfig.length - 1];
  return levelConfig.depth;
}

/**
 * Gets the Elo rating for a specific tier and character index
 */
export function getLevelElo(tier: number, charIdx: number): number {
  const tierConfig = ELO_MAPPING[tier];
  if (!tierConfig) return 100;
  const levelConfig = tierConfig[charIdx] || tierConfig[tierConfig.length - 1];
  return levelConfig.elo;
}
