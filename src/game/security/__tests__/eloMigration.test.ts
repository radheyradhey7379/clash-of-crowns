import { describe, it, expect } from 'vitest';
import { validateAndRepairPlayerData } from '../validatePlayerData';
import { DEFAULT_PLAYER_DATA } from '../../../lib/store/store';
import { PlayerData } from '../../../types';

describe('ELO Zero Migration & Safe Repair Tests', () => {
  it('new_user_rating_starts_at_zero', () => {
    // A fresh default player data should start with ELO 0
    const newPlayer = { ...DEFAULT_PLAYER_DATA };
    expect(newPlayer.rating).toBe(0);
    expect(newPlayer.aiProgress.elo).toBe(0);

    const { data } = validateAndRepairPlayerData(newPlayer);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });

  it('guest_user_rating_starts_at_zero', () => {
    // Guest user with 0 games starts at 0
    const guestPlayer: PlayerData = {
      ...DEFAULT_PLAYER_DATA,
      name: 'Guest',
      rating: 300, // old default
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      aiProgress: {
        ...DEFAULT_PLAYER_DATA.aiProgress,
        elo: 300
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(guestPlayer);
    expect(repaired).toBe(true);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });

  it('existing_zero_game_user_migrates_to_zero', () => {
    // Existing user who has never played any match should migrate to 0
    const legacyUser: any = {
      ...DEFAULT_PLAYER_DATA,
      rating: 300,
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      aiProgress: {
        tier: 'beginner',
        level: 1,
        elo: 300
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(legacyUser);
    expect(repaired).toBe(true);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });

  it('existing_played_user_rating_preserved', () => {
    // Active players who have played matches should keep their rating
    const activePlayer: PlayerData = {
      ...DEFAULT_PLAYER_DATA,
      rating: 1250,
      wins: 10,
      losses: 5,
      draws: 1,
      totalGames: 16,
      aiProgress: {
        ...DEFAULT_PLAYER_DATA.aiProgress,
        elo: 1250
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(activePlayer);
    expect(repaired).toBe(false);
    expect(data.rating).toBe(1250);
    expect(data.aiProgress.elo).toBe(1250);
  });

  it('invalid_rating_repairs_to_zero', () => {
    // Missing, null, NaN, or negative ratings should repair to 0
    const corruptPlayer: any = {
      ...DEFAULT_PLAYER_DATA,
      rating: null,
      wins: 2,
      losses: 1,
      totalGames: 3,
      aiProgress: {
        tier: 'beginner',
        level: 2,
        elo: NaN
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(corruptPlayer);
    expect(repaired).toBe(true);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });

  it('rating_never_below_zero', () => {
    // If rating is negative, it must be set to 0
    const negativePlayer: any = {
      ...DEFAULT_PLAYER_DATA,
      rating: -150,
      wins: 2,
      losses: 1,
      totalGames: 3,
      aiProgress: {
        tier: 'beginner',
        level: 2,
        elo: -150
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(negativePlayer);
    expect(repaired).toBe(true);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });

  it('cloud_user_zero_games_migrates_to_zero', () => {
    // Cloud save containing 300 ELO with 0 games should migrate to 0
    const cloudPlayer: any = {
      ...DEFAULT_PLAYER_DATA,
      rating: 300,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      aiProgress: {
        tier: 'beginner',
        level: 1,
        elo: 300
      }
    };

    const { data, repaired } = validateAndRepairPlayerData(cloudPlayer);
    expect(repaired).toBe(true);
    expect(data.rating).toBe(0);
    expect(data.aiProgress.elo).toBe(0);
  });
});
