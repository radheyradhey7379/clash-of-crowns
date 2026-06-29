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
    { elo: 300, depth: 1 }, { elo: 400, depth: 1 }, { elo: 500, depth: 2 }, { elo: 620, depth: 2 }, { elo: 700, depth: 2 }, // Beginner
    { elo: 760, depth: 2 }, { elo: 820, depth: 2 }, { elo: 880, depth: 3 }, { elo: 940, depth: 3 }, { elo: 1000, depth: 4 }, // Learner
  ],
  // INTERMEDIATE Tab (16 characters: Intermediate 1-8, Hard 1-8)
  [
    { elo: 1100, depth: 3 }, { elo: 1160, depth: 3 }, { elo: 1220, depth: 4 }, { elo: 1280, depth: 4 },
    { elo: 1340, depth: 4 }, { elo: 1400, depth: 5 }, { elo: 1450, depth: 5 }, { elo: 1500, depth: 5 }, // Intermediate
    { elo: 1550, depth: 5 }, { elo: 1620, depth: 6 }, { elo: 1690, depth: 6 }, { elo: 1760, depth: 6 },
    { elo: 1830, depth: 7 }, { elo: 1900, depth: 7 }, { elo: 1950, depth: 7 }, { elo: 2000, depth: 7 }, // Hard
  ],
  // GRANDMASTER Tab (12 characters: Master Cups 1-3 [9], Grandmaster Boss, Daily, Seasonal)
  [
    { elo: 2050, depth: 8 }, { elo: 2100, depth: 8 }, { elo: 2150, depth: 8 }, // Cup 1
    { elo: 2250, depth: 9 }, { elo: 2300, depth: 9 }, { elo: 2350, depth: 9 }, // Cup 2
    { elo: 2425, depth: 10 }, { elo: 2450, depth: 10 }, { elo: 2475, depth: 10 }, // Cup 3
    { elo: 2600, depth: 12 }, { elo: 2700, depth: 14 }, { elo: 2800, depth: 16 }, // Grandmaster
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
