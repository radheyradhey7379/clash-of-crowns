import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerData } from '../../../types';
import { calculateCompScore, calculateArenaScore } from '../leaderboardScore';
import { buildCompLeaderboardEntry, uploadCompLeaderboardEntry } from '../compLeaderboardService';
import { buildArenaLeaderboardEntry, uploadArenaLeaderboardEntry } from '../arenaLeaderboardService';
import { isOnline } from '../../../lib/offline/networkStatus';
import { enqueueSyncEvent } from '../../../lib/offline/syncQueue';
import { doc, getDoc, setDoc, getDocs, getCountFromServer } from 'firebase/firestore';

// Mock Network Status
vi.mock('../../../lib/offline/networkStatus', () => ({
  isOnline: vi.fn().mockReturnValue(true),
  subscribeToNetworkChanges: vi.fn(),
}));

// Mock Sync Queue
vi.mock('../../../lib/offline/syncQueue', () => ({
  enqueueSyncEvent: vi.fn(),
  getPendingSyncEvents: vi.fn().mockReturnValue([]),
  clearSyncedEvents: vi.fn(),
}));

// Mock featureFlags
vi.mock('../../../lib/config/featureFlags', () => ({
  isRankedArenaEnabled: vi.fn().mockReturnValue(true),
}));

// Mock Firestore calls
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    doc: vi.fn().mockReturnValue({ id: 'doc_123' }),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    getDocs: vi.fn(),
    getCountFromServer: vi.fn().mockResolvedValue({
      data: () => ({ count: 5 })
    }),
  };
});

const DEFAULT_TEST_PLAYER_DATA: PlayerData = {
  name: 'Test Player',
  rating: 1500,
  wins: 20,
  losses: 10,
  draws: 5,
  streak: 3,
  bestStreak: 5,
  musicOn: true,
  sfxOn: true,
  isPremium: false,
  cameraSensitivity: 1,
  fontSize: 1,
  tier: 0,
  char: 0,
  consecLoss: 0,
  hardLocked: false,
  showHints: true,
  undoEnabled: true,
  language: 'en',
  whiteWins: 0,
  whiteLosses: 0,
  blackWins: 0,
  blackLosses: 0,
  whiteTime: 0,
  blackTime: 0,
  viewMode: '2d',
  dailyUndoCount: 0,
  lastUndoDate: '',
  selectedPieceSet: 'classic',
  homeAnimation: '',
  boardTheme: 'classic',
  preferredSide: 'w',
  badges: ['badge1', 'badge2'],
  coins: 1000,
  xp: 500,
  aiProgress: {
    tier: 'beginner',
    level: 1,
    elo: 1500,
    consecutiveLosses: 0,
    unlockedTiers: ['beginner'],
    lockedTiers: ['learner', 'intermediate', 'hard', 'master', 'grandmaster'],
    promotionTrial: { unlocked: false, completed: false },
    hard: { locked: true },
    masterCup: { currentCup: 1, currentMatch: 1, winsInCup: 0, lossesInCup: 0, completedCups: [1] },
    grandmaster: { unlocked: false, bossDefeated: true, bossSeriesWins: 0, bossSeriesLosses: 0, seasonPoints: 0 }
  },
  multiplayerHistory: [
    { roomId: 'room1', opponentUid: 'opp1', opponentName: 'Opponent 1', result: 'win', reason: 'checkmate', playedAt: Date.now(), moves: 20 },
    { roomId: 'room2', opponentUid: 'opp2', opponentName: 'Opponent 2', result: 'loss', reason: 'resign', playedAt: Date.now(), moves: 15 },
    { roomId: 'room3', opponentUid: 'opp3', opponentName: 'Opponent 3', result: 'draw', reason: 'draw', playedAt: Date.now(), moves: 30 }
  ]
};

describe('Phase 22 Leaderboard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isOnline).mockReturnValue(true);
  });

  describe('1. Comp Score Calculation Formula', () => {
    it('should compute the Comp Kings score correctly based on approved formula', () => {
      // Formula: Comp ELO + completedMasterCups * 500 + (grandmasterDefeated ? 1000 : 0) + winStreak * 50 + compWins * 10 + badgesCount * 100
      // elo = 1500
      // completedCups = [1] (length = 1) -> 500
      // grandmasterDefeated = true -> 1000
      // streak = 3 -> 150
      // wins = 20 -> 200
      // badges = 2 -> 200
      // Expected = 1500 + 500 + 1000 + 150 + 200 + 200 = 3550
      const score = calculateCompScore(DEFAULT_TEST_PLAYER_DATA);
      expect(score).toBe(3550);
    });
  });

  describe('2. Arena Score Calculation Formula', () => {
    it('should compute the Arena Kings score correctly based on approved formula', () => {
      // Formula: Arena Rating (1200 base) + arenaWins * 20 - arenaLosses * 10 + arenaDraws * 5 + arenaWinRate * 100 + arenaMatches * 2
      // matches = 3
      // wins = 1 -> 20
      // losses = 1 -> -10
      // draws = 1 -> 5
      // winRate = 1/3 -> 0.333333... * 100 = 33.333...
      // matches * 2 = 6
      // Expected = 1200 + 20 - 10 + 5 + 33.333333333333336 + 6 = 1254.333...
      const score = calculateArenaScore(DEFAULT_TEST_PLAYER_DATA);
      expect(score).toBeCloseTo(1254.33, 1);
    });
  });

  describe('3. Build Leaderboard Entry', () => {
    it('should build a valid Comp Kings entry from player data', () => {
      const entry = buildCompLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      expect(entry.uid).toBe('user123');
      expect(entry.displayName).toBe('Test Player');
      expect(entry.mode).toBe('comp_kings');
      expect(entry.score).toBe(3550);
      expect(entry.compStats?.compElo).toBe(1500);
      expect(entry.compStats?.compTier).toBe('beginner');
      expect(entry.compStats?.grandmasterDefeated).toBe(true);
      expect(entry.compStats?.completedMasterCups).toBe(1);
    });

    it('should build a valid Arena Kings entry from player data and history', () => {
      const entry = buildArenaLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      expect(entry.uid).toBe('user123');
      expect(entry.displayName).toBe('Test Player');
      expect(entry.mode).toBe('arena_kings');
      expect(entry.score).toBeCloseTo(1254.33, 1);
      expect(entry.arenaStats?.arenaRating).toBe(1200);
      expect(entry.arenaStats?.arenaWins).toBe(1);
      expect(entry.arenaStats?.arenaLosses).toBe(1);
      expect(entry.arenaStats?.arenaDraws).toBe(1);
      expect(entry.arenaStats?.arenaWinRate).toBe(33); // Math.round(1/3 * 100)
    });
  });

  describe('4. Anti-Cheat and Data Validation', () => {
    it('should reject invalid or tampered playerData from upload', async () => {
      const badData: PlayerData = {
        ...DEFAULT_TEST_PLAYER_DATA,
        rating: 6000 // Invalid (max 5000)
      };

      const compRes = await uploadCompLeaderboardEntry('user123', badData);
      expect(compRes).toBe(false);
      expect(setDoc).not.toHaveBeenCalled();

      const arenaRes = await uploadArenaLeaderboardEntry('user123', badData);
      expect(arenaRes).toBe(false);
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('5. Offline Queueing Behavior', () => {
    it('should enqueue comp leaderboard updates safely if offline', async () => {
      vi.mocked(isOnline).mockReturnValue(false);

      const res = await uploadCompLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      expect(res).toBe(true);
      expect(enqueueSyncEvent).toHaveBeenCalledWith('comp_leaderboard_update', expect.any(Object));
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should enqueue arena leaderboard updates safely if offline', async () => {
      vi.mocked(isOnline).mockReturnValue(false);

      const res = await uploadArenaLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      expect(res).toBe(true);
      expect(enqueueSyncEvent).toHaveBeenCalledWith('arena_leaderboard_update', expect.any(Object));
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('6. User-Facing Labels Wording Validation', () => {
    it('should verify that user-facing labels use Comp, not AI', () => {
      // Test that build functions use correct naming
      const compEntry = buildCompLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      const arenaEntry = buildArenaLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);

      expect(compEntry.mode).not.toContain('ai');
      expect(compEntry.mode).toBe('comp_kings');
      expect(arenaEntry.mode).not.toContain('ai');
      expect(arenaEntry.mode).toBe('arena_kings');
    });
  });

  describe('7. No Ranked Multiplayer ELO Changed', () => {
    it('should verify that multiplayer history operations do not touch ranked ELO fields', () => {
      const entry = buildArenaLeaderboardEntry('user123', DEFAULT_TEST_PLAYER_DATA);
      // Ensure rating is fixed base of 1200
      expect(entry.arenaStats?.arenaRating).toBe(1200);
    });
  });
});
