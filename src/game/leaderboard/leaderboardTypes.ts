import { AITier } from '../../types';

export type LeaderboardMode = 'comp_kings' | 'arena_kings';

export const MAX_COMP_LEADERBOARD_SCORE = 10_000_000;

export interface CompLeaderboardStats {
  compElo: number;
  compTier: AITier;
  compWins: number;
  compMatches: number;
  compWinStreak: number;
  completedMasterCups: number;
  grandmasterDefeated: boolean;
}

export interface ArenaLeaderboardStats {
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  arenaDraws: number;
  arenaWinRate: number; // between 0 and 100
  arenaMatches: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  mode: LeaderboardMode;
  rank?: number;
  score: number;
  badges?: string[];
  updatedAt: number;
  compStats?: CompLeaderboardStats;
  arenaStats?: ArenaLeaderboardStats;
}
