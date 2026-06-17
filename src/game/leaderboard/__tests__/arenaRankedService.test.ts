import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyVerifiedArenaLeaderboardUpdate, VerifiedRankedResult } from '../arenaRankedService';
import { PlayerData } from '../../../types';
import * as arenaLeaderboardService from '../arenaLeaderboardService';

vi.mock('../arenaLeaderboardService', () => ({
  uploadArenaLeaderboardEntry: vi.fn().mockResolvedValue(undefined),
}));

describe('arenaRankedService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const basePlayer = {
    uid: 'test_uid',
    name: 'Test Player',
    arenaRating: 1200,
    appliedArenaResultIds: [],
    multiplayerHistory: [],
  } as unknown as PlayerData;

  const validResult: VerifiedRankedResult = {
    room_id: 'room1',
    ranked_match_id: 'match1',
    result: 'white_win',
    reason: 'checkmate',
    move_count: 20,
    duration_ms: 60000,
    rating_delta_white: 15,
    rating_delta_black: -15,
    new_rating_white: 1215,
    new_rating_black: 1185,
    verification_hash: 'hash_xyz',
  };

  it('ignores missing or invalid verified result', () => {
    const { updatedData, success } = applyVerifiedArenaLeaderboardUpdate(basePlayer, null as any, 'w');
    expect(success).toBe(false);
    expect(updatedData).toEqual(basePlayer);
  });

  it('ignores duplicate verified result', () => {
    const playerWithMatch: PlayerData = {
      ...basePlayer,
      appliedArenaResultIds: ['match1'],
    };
    const { updatedData, success } = applyVerifiedArenaLeaderboardUpdate(playerWithMatch, validResult, 'w');
    expect(success).toBe(false);
    expect(updatedData).toEqual(playerWithMatch);
  });

  it('applies verified result for white win correctly', () => {
    const { updatedData, success } = applyVerifiedArenaLeaderboardUpdate(basePlayer, validResult, 'w');
    expect(success).toBe(true);
    expect(updatedData.arenaRating).toBe(1215);
    expect(updatedData.appliedArenaResultIds).toContain('match1');
    expect(updatedData.multiplayerHistory?.length).toBe(1);
    expect(updatedData.multiplayerHistory?.[0].result).toBe('win');
  });

  it('applies verified result for black loss correctly', () => {
    const { updatedData, success } = applyVerifiedArenaLeaderboardUpdate(basePlayer, validResult, 'b');
    expect(success).toBe(true);
    expect(updatedData.arenaRating).toBe(1185);
    expect(updatedData.appliedArenaResultIds).toContain('match1');
    expect(updatedData.multiplayerHistory?.length).toBe(1);
    expect(updatedData.multiplayerHistory?.[0].result).toBe('loss');
  });

  it('enforces rating floor of 100', () => {
    const playerWithLowRating: PlayerData = { ...basePlayer, arenaRating: 105 };
    const { updatedData, success } = applyVerifiedArenaLeaderboardUpdate(playerWithLowRating, validResult, 'b');
    expect(success).toBe(true);
    // 105 - 15 = 90, floored to 100
    expect(updatedData.arenaRating).toBe(100);
  });
});
