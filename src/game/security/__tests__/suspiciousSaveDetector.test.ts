import { describe, it, expect } from 'vitest';
import { detectSuspiciousSave } from '../suspiciousSaveDetector';
import { PlayerData } from '../../../types';

describe('Suspicious Save Detector', () => {
  const getValidData = (): PlayerData => ({
    coins: 100,
    xp: 50,
    rating: 1200,
    aiProgress: {
      tier: 'beginner',
      level: 1,
      elo: 1200,
      consecutiveLosses: 0,
      unlockedTiers: ['core', 'beginner'],
      lockedTiers: ['learner', 'promotion_trial', 'intermediate', 'hard', 'master', 'grandmaster'],
      claimedTierRewards: [],
      claimedCupRewards: [],
      promotionTrial: { unlocked: false, completed: false },
      hard: { locked: true },
      masterCup: { currentCup: 1, currentMatch: 1, completedCups: [], winsInCup: 0, lossesInCup: 0 },
      grandmaster: { unlocked: false, bossDefeated: false, bossSeriesWins: 0, bossSeriesLosses: 0, seasonPoints: 0 }
    }
  } as unknown as PlayerData);

  it('allows valid data', () => {
    const data = getValidData();
    const result = detectSuspiciousSave(data);
    expect(result.suspicious).toBe(false);
    expect(result.shouldBlockCloudUpload).toBe(false);
  });

  it('flags missing data as critical', () => {
    const result = detectSuspiciousSave(null);
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.flags).toContain('missing_data');
    expect(result.shouldBlockCloudUpload).toBe(true);
  });

  it('flags negative coins as high severity', () => {
    const data = getValidData();
    data.coins = -10;
    const result = detectSuspiciousSave(data);
    expect(result.severity).toBe('high');
    expect(result.flags).toContain('negative_coins');
    expect(result.shouldBlockCloudUpload).toBe(true);
  });

  it('flags impossible coin caps as high', () => {
    const data = getValidData();
    data.coins = 99999999;
    const result = detectSuspiciousSave(data);
    expect(result.severity).toBe('high');
    expect(result.flags).toContain('impossible_coins_cap');
  });

  it('flags future timestamps as medium severity', () => {
    const data = getValidData();
    data.lastValidatedAt = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days future
    const result = detectSuspiciousSave(data);
    expect(result.severity).toBe('medium');
    expect(result.flags).toContain('future_validation_timestamp');
  });

  it('flags impossible unlock logic', () => {
    const data = getValidData();
    // Unlock grandmaster but completed cups does not include 3
    data.aiProgress!.unlockedTiers.push('grandmaster');
    const result = detectSuspiciousSave(data);
    expect(result.severity).toBe('high');
    expect(result.flags).toContain('impossible_grandmaster_unlock');
  });

  it('advisory match count for legacy saves (saveVersion < 2)', () => {
    const data = getValidData();
    data.saveVersion = 1;
    data.totalMatchesCompleted = 5;
    data.aiProgress!.unlockedTiers.push('hard', 'master');
    const result = detectSuspiciousSave(data);
    
    expect(result.severity).toBe('medium'); // Not high
    expect(result.shouldBlockCloudUpload).toBe(false); // Does not block
    expect(result.flags).toContain('impossible_matches_for_master');
  });

  it('strict match count for new saves (saveVersion >= 2)', () => {
    const data = getValidData();
    data.saveVersion = 2;
    data.totalMatchesCompleted = 5;
    data.aiProgress!.unlockedTiers.push('hard', 'master');
    const result = detectSuspiciousSave(data);
    
    expect(result.severity).toBe('high');
    expect(result.shouldBlockCloudUpload).toBe(true);
    expect(result.flags).toContain('impossible_matches_for_master');
  });
});
