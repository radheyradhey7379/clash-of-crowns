import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerData, SecurityFlag } from '../../../types';
import { DEFAULT_PLAYER_DATA } from '../../../lib/store';
import {
  createProtectedSave,
  verifyProtectedSave,
  loadProtectedPlayerData,
  saveProtectedPlayerData,
  getOrCreateDeviceId
} from '../../../lib/protectedSave';
import {
  validatePlayerData,
  validateAndRepairPlayerData
} from '../validatePlayerData';
import {
  createMatchSession,
  validateMatchCompletion,
  markMatchCompleted
} from '../matchSessionGuard';
import { matchFlowService } from '../../ai/matchFlowService';

// Mock LocalStorage in Node environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const mockLocalStorage = new LocalStorageMock();

if (typeof global.window === 'undefined') {
  global.window = {} as any;
}
global.localStorage = mockLocalStorage as any;

describe('Save Security & Anti-Cheat System (Phase 17)', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Protected Save Integrity (SHA-256 Checksums)', () => {
    it('should generate a valid protected save and verify successfully', () => {
      const data: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1200,
        coins: 1000,
        xp: 500,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1200
        }
      };

      const save = createProtectedSave(data);
      expect(save.version).toBe('1.0.0');
      expect(JSON.parse(save.payload).rating).toBe(1200);
      expect(verifyProtectedSave(save)).toBe(true);
    });

    it('should reject a tampered save payload', () => {
      const data: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1200,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1200
        }
      };

      const save = createProtectedSave(data);
      // Tamper with rating inside the payload
      const payloadObj = JSON.parse(save.payload);
      payloadObj.rating = 5000;
      save.payload = JSON.stringify(payloadObj);

      expect(verifyProtectedSave(save)).toBe(false);
    });

    it('should reject a tampered checksum', () => {
      const data: PlayerData = { ...DEFAULT_PLAYER_DATA };
      const save = createProtectedSave(data);
      save.checksum = 'tampered_checksum_value_123';
      expect(verifyProtectedSave(save)).toBe(false);
    });
  });

  describe('2. Backup Recovery & Primary Save Failure', () => {
    it('should load primary save correctly if valid', () => {
      const data: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1500,
        coins: 2000,
        wins: 1,
        totalGames: 1,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1500
        }
      };

      saveProtectedPlayerData(data);

      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      expect(loaded.rating).toBe(1500);
      expect(loaded.coins).toBe(2000);
    });

    it('should recover from backup if primary save is corrupt/tampered', () => {
      const data: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1400,
        coins: 1500,
        wins: 1,
        totalGames: 1,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1400
        }
      };

      // Save twice to populate backup with 'data'
      saveProtectedPlayerData(data);
      saveProtectedPlayerData(data);

      // Tamper with primary save in localstorage
      const primaryJson = mockLocalStorage.getItem('clash_player_data');
      expect(primaryJson).not.toBeNull();
      const primaryParsed = JSON.parse(primaryJson!);
      primaryParsed.checksum = 'broken_checksum';
      mockLocalStorage.setItem('clash_player_data', JSON.stringify(primaryParsed));

      // Loading should fall back to backup, repair it, and log a high-severity event
      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      expect(loaded.rating).toBe(1400);
      expect(loaded.coins).toBe(1500);

      // Verify the high-severity flag about primary failure was added
      expect(loaded.securityFlags).toBeDefined();
      const primaryFailFlag = loaded.securityFlags?.find(f => f.type === 'checksum_mismatch');
      expect(primaryFailFlag).toBeDefined();
      expect(primaryFailFlag?.severity).toBe('high');
    });

    it('should reset to default if both primary and backup saves are invalid', () => {
      const data: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1800,
        wins: 1,
        totalGames: 1,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1800
        }
      };

      saveProtectedPlayerData(data);
      saveProtectedPlayerData(data);

      // Tamper with both primary and backup
      const primary = JSON.parse(mockLocalStorage.getItem('clash_player_data')!);
      primary.checksum = 'bad';
      mockLocalStorage.setItem('clash_player_data', JSON.stringify(primary));

      const backup = JSON.parse(mockLocalStorage.getItem('clash_player_data_backup')!);
      backup.checksum = 'bad';
      mockLocalStorage.setItem('clash_player_data_backup', JSON.stringify(backup));

      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      // Reset to default
      expect(loaded.rating).toBe(0); // DEFAULT rating
      const flags = loaded.securityFlags || [];
      expect(flags.some(f => f.severity === 'high' && f.type === 'checksum_mismatch')).toBe(true);
    });
  });

  describe('3. Legacy Save Migration', () => {
    it('should successfully migrate a legacy plain-text save', () => {
      const legacyData = {
        name: 'LegacyPlayer',
        rating: 1250,
        wins: 10,
        losses: 5,
        draws: 2
      };

      mockLocalStorage.setItem('clash_of_crowns_player_data', JSON.stringify(legacyData));

      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      expect(loaded.name).toBe('LegacyPlayer');
      expect(loaded.rating).toBe(1250);
      expect(loaded.aiProgress.elo).toBe(1250);

      // Verify legacy migration flag added
      expect(loaded.securityFlags?.some(f => f.type === 'legacy_save_migration')).toBe(true);
      // Verify legacy key was cleaned up
      expect(mockLocalStorage.getItem('clash_of_crowns_player_data')).toBeNull();
    });
  });

  describe('4. Player Data & Progression Range Bounds Validation', () => {
    it('should repair values exceeding bounds', () => {
      const badData: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 6000, // max 5000
        coins: 25000000, // max 10,000,000
        xp: 80000000, // max 50,000,000
        wins: 1,
        totalGames: 1,
        badges: 'not_an_array' as any,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 6000
        }
      };

      const { data: repaired, repaired: isRepaired, flags } = validateAndRepairPlayerData(badData);
      expect(isRepaired).toBe(true);
      expect(repaired.rating).toBe(5000);
      expect(repaired.coins).toBe(10000000);
      expect(repaired.xp).toBe(50000000);
      expect(Array.isArray(repaired.badges)).toBe(true);
      expect(repaired.badges.length).toBe(0);

      expect(flags.some(f => f.type === 'invalid_elo_cap' || f.type === 'impossible_rating_cap')).toBe(true);
      expect(flags.some(f => f.type === 'invalid_coin_cap' || f.type === 'impossible_coins_cap')).toBe(true);
      expect(flags.some(f => f.type === 'invalid_xp_cap' || f.type === 'impossible_xp_cap')).toBe(true);
    });

    it('should repair invalid progression level or tier', () => {
      const badData: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          tier: 'invalid_tier' as any,
          level: -5
        }
      };

      const { data: repaired, repaired: isRepaired } = validateAndRepairPlayerData(badData);
      expect(isRepaired).toBe(true);
      expect(repaired.aiProgress.tier).toBe('beginner');
      expect(repaired.aiProgress.level).toBe(1);
    });

    it('should repair inconsistent progression states (e.g. intermediate unlocked but trial incomplete)', () => {
      const inconsistentData: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          tier: 'intermediate',
          level: 2,
          unlockedTiers: ['beginner', 'learner', 'intermediate'],
          lockedTiers: ['hard', 'master', 'grandmaster'],
          promotionTrial: {
            unlocked: true,
            completed: false // ERROR: Intermediate unlocked but trial not completed!
          }
        }
      };

      const { data: repaired, repaired: isRepaired, flags } = validateAndRepairPlayerData(inconsistentData);
      expect(isRepaired).toBe(true);
      expect(repaired.aiProgress.tier).toBe('learner');
      expect(repaired.aiProgress.level).toBe(5);
      expect(repaired.aiProgress.unlockedTiers).not.toContain('intermediate');
      expect(flags.some(f => f.type === 'impossible_intermediate_state')).toBe(true);
    });

    it('should repair master tier unlocked without hard tier unlocked', () => {
      const inconsistentData: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          tier: 'master',
          level: 1,
          unlockedTiers: ['beginner', 'learner', 'intermediate', 'master'],
          lockedTiers: ['hard', 'grandmaster'], // ERROR: Hard tier not unlocked!
          promotionTrial: {
            unlocked: true,
            completed: true // intermediate is validly unlocked
          }
        }
      };

      const { data: repaired, repaired: isRepaired, flags } = validateAndRepairPlayerData(inconsistentData);
      expect(isRepaired).toBe(true);
      expect(repaired.aiProgress.tier).toBe('hard');
      expect(repaired.aiProgress.level).toBe(1);
      expect(repaired.aiProgress.unlockedTiers).toContain('hard');
      expect(repaired.aiProgress.unlockedTiers).not.toContain('master');
      expect(flags.some(f => f.type === 'impossible_master_state')).toBe(true);
    });
  });

  describe('5. Match Session Guard & Time Check', () => {
    it('should create an active session and validate completion correctly', () => {
      const matchId = createMatchSession('beginner_1');
      expect(matchId).toBeDefined();

      const sessionJson = mockLocalStorage.getItem('clash_active_match_session');
      expect(sessionJson).not.toBeNull();
      const session = JSON.parse(sessionJson!);
      const expectedCharId = 'beginner_1';
      expect(session.matchId).toBe(matchId);
      expect(session.characterId).toBe(expectedCharId);
      expect(session.status).toBe('active');

      // Fast-forward 6 seconds to pass too-fast checks
      vi.advanceTimersByTime(6000);

      const validation = validateMatchCompletion(matchId, expectedCharId, 'win', DEFAULT_PLAYER_DATA);
      expect(validation.valid).toBe(true);
    });

    it('should block completions for locked characters', () => {
      // learner_1 is locked at start
      const matchId = createMatchSession('learner_1');
      vi.advanceTimersByTime(10000);

      const validation = validateMatchCompletion(matchId, 'learner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('locked_character_attempt');
    });

    it('should block games completed under 2 seconds', () => {
      const matchId = createMatchSession('beginner_1');
      vi.advanceTimersByTime(1000); // 1 second elapsed

      const validation = validateMatchCompletion(matchId, 'beginner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('too_fast_match');
    });

    it('should warning flag but allow games completed between 2 and 5 seconds', () => {
      const matchId = createMatchSession('beginner_1');
      vi.advanceTimersByTime(3000); // 3 seconds elapsed

      const validation = validateMatchCompletion(matchId, 'beginner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation.valid).toBe(true);
      expect(validation.reason).toBe('too_fast_suspicious');
    });
  });

  describe('6. Duplicate Match Reward Prevention', () => {
    it('should block matching with a previously completed match ID', () => {
      const matchId = createMatchSession('beginner_1');
      vi.advanceTimersByTime(7000);

      const validation1 = validateMatchCompletion(matchId, 'beginner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation1.valid).toBe(true);

      // Mark completed
      markMatchCompleted(matchId);

      // Verify cache
      const completed = JSON.parse(mockLocalStorage.getItem('clash_completed_matches')!);
      expect(completed).toContain(matchId);

      // Try validating again
      const validation2 = validateMatchCompletion(matchId, 'beginner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation2.valid).toBe(false);
      expect(validation2.reason).toBe('duplicate_match_result');
    });

    it('should recover from corrupt clash_completed_matches cache', () => {
      mockLocalStorage.setItem('clash_completed_matches', JSON.stringify({ malicious: 'object' }));
      const matchId = createMatchSession('beginner_1');
      vi.advanceTimersByTime(7000);

      const validation = validateMatchCompletion(matchId, 'beginner_1', 'win', DEFAULT_PLAYER_DATA);
      expect(validation.valid).toBe(true);
      
      markMatchCompleted(matchId);
      const completed = JSON.parse(mockLocalStorage.getItem('clash_completed_matches')!);
      expect(Array.isArray(completed)).toBe(true);
      expect(completed).toContain(matchId);
    });
  });

  describe('7. Match Flow Integration & Impossible Jump Guarding', () => {
    it('should process match result, apply progression/rewards, and clip impossible jumps', () => {
      const matchId = createMatchSession('beginner_1');
      vi.advanceTimersByTime(8000);

      const summary = matchFlowService.processMatchResult({
        matchId,
        characterId: 'beginner_1',
        result: 'win',
        reason: 'checkmate',
        eloBefore: 100
      }, DEFAULT_PLAYER_DATA);

      // Verify match was marked completed and session cleaned up/marked completed
      const completedList = JSON.parse(mockLocalStorage.getItem('clash_completed_matches')!);
      expect(completedList).toContain(matchId);

      // Normal pawnling rook win awards standard ELO, coins, and XP, which should NOT exceed limits.
      expect(summary.eloChange).toBeLessThanOrEqual(50);
      expect(summary.rewards.coins).toBeLessThanOrEqual(750);
      expect(summary.rewards.xp).toBeLessThanOrEqual(150);
    });

    it('should reject match completion and return 0 rewards on session violation', () => {
      // Attempting to complete a match without creating a session first
      const summary = matchFlowService.processMatchResult({
        matchId: 'ghost_match_123',
        characterId: 'beginner_1',
        result: 'win',
        reason: 'checkmate',
        eloBefore: 100
      }, DEFAULT_PLAYER_DATA);

      expect(summary.eloChange).toBe(0);
      expect(summary.rewards.coins).toBe(0);
      expect(summary.rewards.xp).toBe(0);
      
      // Loaded data should contain a security flag for invalid session
      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      expect(loaded.securityFlags?.some(f => f.type === 'invalid_session')).toBe(true);
    });
  });

  describe('8. Device ID Binding', () => {
    it('should generate device ID and bind it to the save', () => {
      const deviceId = getOrCreateDeviceId();
      expect(deviceId).toBeDefined();

      const data = { ...DEFAULT_PLAYER_DATA };
      saveProtectedPlayerData(data);

      const rawSave = JSON.parse(mockLocalStorage.getItem('clash_player_data')!);
      expect(rawSave.deviceId).toBe(deviceId);
    });

    it('should accept cross-device save but log device_change_detected flag', () => {
      const originalDeviceId = 'device_alpha';
      const currentDeviceId = getOrCreateDeviceId(); // gets node_environment in mock
      
      const originalData: PlayerData = {
        ...DEFAULT_PLAYER_DATA,
        rating: 1300,
        wins: 1,
        totalGames: 1,
        deviceId: originalDeviceId,
        aiProgress: {
          ...DEFAULT_PLAYER_DATA.aiProgress,
          elo: 1300
        }
      };

      // Create a save using original deviceId
      const save = {
        version: '1.0.0',
        payload: JSON.stringify(originalData),
        updatedAt: Date.now(),
        deviceId: originalDeviceId,
        checksum: ''
      };
      // Compute checksum using original deviceId
      const CryptoJS = require('crypto-js');
      save.checksum = CryptoJS.SHA256(`${save.payload}|${save.updatedAt}|${save.deviceId}|${save.version}`).toString();

      // Put it in localstorage
      mockLocalStorage.setItem('clash_player_data', JSON.stringify(save));

      // Load it. It should accept the save, but log a medium-severity flag and update the deviceId
      const loaded = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);
      expect(loaded.rating).toBe(1300);
      expect(loaded.deviceId).toBe(currentDeviceId);

      expect(loaded.securityFlags?.some(f => f.type === 'device_change_detected' && f.severity === 'medium')).toBe(true);
    });
  });
});
