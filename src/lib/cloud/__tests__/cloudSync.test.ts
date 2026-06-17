import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncNow, getSyncStatus, getPendingCount, triggerDebouncedSync } from '../cloudSyncManager';
import { localPlayerStore } from '../../offline/localPlayerStore';
import { enqueueSyncEvent, getPendingSyncEvents, clearSyncedEvents } from '../../offline/syncQueue';
import { isOnline } from '../../offline/networkStatus';
import { auth } from '../../firebase';
import { DEFAULT_PLAYER_DATA } from '../../store';
import { PlayerData } from '../../../types';
import { createProtectedSave, computeChecksum } from '../../protectedSave';
import { getDoc, setDoc, updateDoc, doc } from 'firebase/firestore';

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

// Helper to write a valid signed local save with custom updatedAt timestamp
function saveLocalWithTimestamp(data: PlayerData, updatedAt: number) {
  const save = createProtectedSave(data);
  save.updatedAt = updatedAt;
  save.checksum = computeChecksum(save.payload, save.updatedAt, save.deviceId, save.version);
  mockLocalStorage.setItem('clash_player_data', JSON.stringify(save));
  mockLocalStorage.setItem('clash_player_data_backup', JSON.stringify(save));
}

// Mock firestore queries
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    doc: vi.fn().mockReturnValue({ id: 'doc_123' }),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
  };
});

vi.mock('../../offline/networkStatus', () => ({
  isOnline: vi.fn().mockReturnValue(true),
  subscribeToNetworkChanges: vi.fn().mockReturnValue(() => {}),
}));

let mockUser: any = { uid: 'user_123' };

vi.mock('../../firebase', () => ({
  auth: {
    get currentUser() {
      return mockUser;
    }
  },
  onAuthStateChanged: vi.fn().mockReturnValue(() => {}),
  db: {},
}));

describe('Cloud Save & Firebase Sync System (Phase 19)', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    clearSyncedEvents();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock behavior for network status & auth
    vi.mocked(isOnline).mockReturnValue(true);
    mockUser = { uid: 'user_123' };

    // Default mock behavior for firestore calls
    vi.mocked(doc).mockReturnValue({ id: 'doc_123' } as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => null
    } as any);
    vi.mocked(setDoc).mockResolvedValue(undefined as any);
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Sync Pre-requisite Checks (Offline & Authentication)', () => {
    it('offline user does not sync', async () => {
      vi.mocked(isOnline).mockReturnValue(false);

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('offline');
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('unauthenticated user does not sync', async () => {
      mockUser = null;

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('unauthenticated');
      expect(getDoc).not.toHaveBeenCalled();
    });
  });

  describe('2. Validation & Security Checks', () => {
    it('invalid local data not uploaded', async () => {
      // Create invalid local data (coins exceed max limit)
      const invalidData = {
        ...DEFAULT_PLAYER_DATA,
        coins: 999999999
      };

      // Set mock save directly in localStorage
      saveLocalWithTimestamp(invalidData, Date.now());
      
      // Spy on localPlayerStore to return invalidData bypassing the load-repair logic
      vi.spyOn(localPlayerStore, 'loadLocalData').mockReturnValue(invalidData);

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('failed');
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('invalid cloud data rejected', async () => {
      const localData = { ...DEFAULT_PLAYER_DATA };
      saveLocalWithTimestamp(localData, 1000);

      // Mock cloud to return corrupted/invalid save (rating out of bounds)
      const corruptedCloudData = {
        ...DEFAULT_PLAYER_DATA,
        rating: -500
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          uid: 'user_123',
          playerData: corruptedCloudData,
          aiProgress: corruptedCloudData.aiProgress,
          coins: 0,
          xp: 0,
          badges: [],
          settings: {} as any,
          saveVersion: '1.0.0',
          updatedAt: 2000,
          deviceId: 'device_123',
          localSaveHash: 'hash',
          lastSyncedAt: Date.now()
        })
      } as any);

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('failed');
      
      // Verify local save was not overwritten by corrupted data
      const loaded = localPlayerStore.loadLocalData();
      expect(loaded.rating).toBe(100); // kept valid default
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('3. Conflict Resolution & Merging', () => {
    it('local newer uploads directly to cloud', async () => {
      const localData = { ...DEFAULT_PLAYER_DATA, coins: 500 };
      saveLocalWithTimestamp(localData, 2000); // Newer local

      const cloudSavePayload = {
        ...DEFAULT_PLAYER_DATA,
        coins: 100
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          uid: 'user_123',
          playerData: cloudSavePayload,
          aiProgress: cloudSavePayload.aiProgress,
          coins: 100,
          xp: 0,
          badges: [],
          settings: {} as any,
          saveVersion: '1.0.0',
          updatedAt: 1000, // Older cloud
          deviceId: 'device_123',
          localSaveHash: 'hash_cloud',
          lastSyncedAt: Date.now()
        })
      } as any);

      const result = await syncNow();
      expect(result).toBe(true);
      expect(getSyncStatus()).toBe('synced');
      expect(setDoc).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ coins: 500 })
      );
    });

    it('cloud newer merges and uploads merged data', async () => {
      // Local is older (updatedAt: 1000)
      const localData = {
        ...DEFAULT_PLAYER_DATA,
        coins: 200,
        xp: 100,
        rating: 1200,
        aiProgress: { ...DEFAULT_PLAYER_DATA.aiProgress, elo: 1200 },
        badges: ['badge_local'],
        musicOn: true // Local setting
      };
      saveLocalWithTimestamp(localData, 1000);

      // Cloud is newer (updatedAt: 3000)
      const cloudData = {
        ...DEFAULT_PLAYER_DATA,
        coins: 1000, // higher
        xp: 500, // higher
        rating: 1100, // local is higher, so we merge to 1200
        aiProgress: { ...DEFAULT_PLAYER_DATA.aiProgress, elo: 1100 },
        badges: ['badge_cloud'],
        musicOn: false // Cloud setting
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          uid: 'user_123',
          playerData: cloudData,
          aiProgress: cloudData.aiProgress,
          coins: 1000,
          xp: 500,
          badges: ['badge_cloud'],
          settings: {} as any,
          saveVersion: '1.0.0',
          updatedAt: 3000,
          deviceId: 'device_123',
          localSaveHash: 'hash_cloud',
          lastSyncedAt: Date.now()
        })
      } as any);

      const result = await syncNow();
      expect(result).toBe(true);
      expect(getSyncStatus()).toBe('synced');

      // Verify merged local data:
      const mergedLocal = localPlayerStore.loadLocalData();
      expect(mergedLocal.coins).toBe(1000); // Cloud higher
      expect(mergedLocal.xp).toBe(500); // Cloud higher
      expect(mergedLocal.rating).toBe(1200); // Local higher (Math.max)
      expect(mergedLocal.badges).toContain('badge_local');
      expect(mergedLocal.badges).toContain('badge_cloud'); // Union
      expect(mergedLocal.musicOn).toBe(true); // Kept local setting!
    });

    it('unclear conflict keeps local and logs warning', async () => {
      // Local and cloud have same timestamps
      const localData = { ...DEFAULT_PLAYER_DATA, coins: 50 };
      saveLocalWithTimestamp(localData, 1500);

      const cloudSavePayload = {
        ...DEFAULT_PLAYER_DATA,
        coins: 150
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          uid: 'user_123',
          playerData: cloudSavePayload,
          aiProgress: cloudSavePayload.aiProgress,
          coins: 150,
          xp: 0,
          badges: [],
          settings: {} as any,
          saveVersion: '1.0.0',
          updatedAt: 1500, // Same
          deviceId: 'device_123',
          localSaveHash: 'hash_cloud',
          lastSyncedAt: Date.now()
        })
      } as any);

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('failed');
      expect(setDoc).not.toHaveBeenCalled();
    });
  });

  describe('4. Sync Queue & Batched Uploads', () => {
    it('failed upload keeps queue events pending', async () => {
      // Enqueue sync events
      enqueueSyncEvent('ai_match_completed', { characterId: 'core_1', result: 'win' });
      enqueueSyncEvent('rewards_granted', { coins: 100 });
      expect(getPendingCount()).toBe(2);

      // Setup valid local save
      saveLocalWithTimestamp(DEFAULT_PLAYER_DATA, Date.now());

      // Mock upload failure
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => null } as any);
      vi.mocked(setDoc).mockRejectedValue(new Error('Network failure'));

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('failed');
      // Events remain pending
      expect(getPendingCount()).toBe(2);
    });

    it('successful upload clears/marks queue events completed', async () => {
      enqueueSyncEvent('ai_match_completed', { characterId: 'core_1', result: 'win' });
      enqueueSyncEvent('badge_unlocked', { badgeId: 'badge_1' });
      expect(getPendingCount()).toBe(2);

      saveLocalWithTimestamp(DEFAULT_PLAYER_DATA, Date.now());

      // Mock upload success
      vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => null } as any);
      vi.mocked(setDoc).mockResolvedValue(undefined as any);

      const result = await syncNow();
      expect(result).toBe(true);
      expect(getSyncStatus()).toBe('synced');
      // Events cleared
      expect(getPendingCount()).toBe(0);
      expect(getPendingSyncEvents().length).toBe(0);
    });
  });

  describe('5. Safety & Crash Prevention', () => {
    it('Firestore error does not crash app', async () => {
      saveLocalWithTimestamp(DEFAULT_PLAYER_DATA, Date.now());

      // Mock getDoc to throw an error
      vi.mocked(getDoc).mockRejectedValue(new Error('Firestore permission-denied'));

      const result = await syncNow();
      expect(result).toBe(false);
      expect(getSyncStatus()).toBe('failed');
      
      // Local store remains active and healthy
      const loaded = localPlayerStore.loadLocalData();
      expect(loaded).toBeDefined();
      expect(loaded.rating).toBe(100);
    });
  });
});
