import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { canUseFeature, shouldBlockOnlineFeature, isOfflineMode } from '../offlineMode';
import { isOnline, subscribeToNetworkChanges } from '../networkStatus';
import {
  enqueueSyncEvent,
  getPendingSyncEvents,
  markSyncEventCompleted,
  clearSyncedEvents
} from '../syncQueue';
import { localPlayerStore } from '../localPlayerStore';
import {
  getOfflinePackageMetadata,
  saveOfflinePackageMetadata,
  downloadOfflinePackage,
  resetOfflinePackage,
  OfflinePackageMetadata
} from '../offlinePackage';
import { DEFAULT_PLAYER_DATA } from '../../store';

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

describe('Offline Mode & Capabilities System', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
    
    // Default mock behavior for navigator.onLine
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  describe('1. Capabilities Check (canUseFeature & shouldBlockOnlineFeature)', () => {
    it('should allow all features when online', () => {
      // When online = true
      Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true });

      expect(isOfflineMode()).toBe(false);
      expect(canUseFeature('aiCareer')).toBe(true);
      expect(canUseFeature('playComputer')).toBe(true);
      expect(canUseFeature('multiplayer')).toBe(true);
      expect(canUseFeature('chat')).toBe(true);
      expect(shouldBlockOnlineFeature('multiplayer')).toBe(false);
    });

    it('should restrict features when offline', () => {
      // When online = false
      Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true });

      expect(isOfflineMode()).toBe(true);
      
      // Allowed offline features
      expect(canUseFeature('aiCareer')).toBe(true);
      expect(canUseFeature('playComputer')).toBe(true);
      expect(canUseFeature('localProfile')).toBe(true);
      expect(shouldBlockOnlineFeature('aiCareer')).toBe(false);

      // Blocked offline features
      expect(canUseFeature('multiplayer')).toBe(false);
      expect(canUseFeature('chat')).toBe(false);
      expect(canUseFeature('cloudSave')).toBe(false);
      expect(shouldBlockOnlineFeature('multiplayer')).toBe(true);
      expect(shouldBlockOnlineFeature('chat')).toBe(true);
    });
  });

  describe('2. Network Status Event Subscription', () => {
    let originalAddEventListener: typeof window.addEventListener;
    let originalRemoveEventListener: typeof window.removeEventListener;
    let registeredListeners: Record<string, ((e: Event) => void)[]> = {};

    beforeEach(() => {
      registeredListeners = {};
      originalAddEventListener = global.window.addEventListener;
      originalRemoveEventListener = global.window.removeEventListener;

      global.window.addEventListener = vi.fn((event: string, callback: any) => {
        if (!registeredListeners[event]) {
          registeredListeners[event] = [];
        }
        registeredListeners[event].push(callback);
      });

      global.window.removeEventListener = vi.fn((event: string, callback: any) => {
        if (registeredListeners[event]) {
          registeredListeners[event] = registeredListeners[event].filter(cb => cb !== callback);
        }
      });
    });

    afterEach(() => {
      global.window.addEventListener = originalAddEventListener;
      global.window.removeEventListener = originalRemoveEventListener;
    });

    it('should track connection changes and invoke subscriber callbacks', () => {
      Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true });

      const callback = vi.fn();
      const unsubscribe = subscribeToNetworkChanges(callback);

      // Immediately called with current online status
      expect(callback).toHaveBeenCalledWith(true);

      // Simulate transition to offline
      Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true });
      if (registeredListeners['offline']) {
        registeredListeners['offline'].forEach(cb => cb(new Event('offline')));
      }

      expect(callback).toHaveBeenLastCalledWith(false);

      // Simulate transition to online
      Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true });
      if (registeredListeners['online']) {
        registeredListeners['online'].forEach(cb => cb(new Event('online')));
      }

      expect(callback).toHaveBeenLastCalledWith(true);

      // Unsubscribe
      unsubscribe();
      expect(global.window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(global.window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('3. Offline Sync Queue (syncQueue)', () => {
    it('should successfully queue events and retrieve them', () => {
      const e1 = enqueueSyncEvent('ai_match_completed', { characterId: 'core_1', result: 'win' });
      const e2 = enqueueSyncEvent('rewards_granted', { coins: 50, xp: 100 });

      expect(e1.id).toBeDefined();
      expect(e1.type).toBe('ai_match_completed');
      expect(e2.type).toBe('rewards_granted');

      const pending = getPendingSyncEvents();
      expect(pending.length).toBe(2);
      expect(pending[0].id).toBe(e1.id);
      expect(pending[1].id).toBe(e2.id);
    });

    it('should mark specific events completed and remove them from the queue', () => {
      const e1 = enqueueSyncEvent('ai_match_completed', {});
      const e2 = enqueueSyncEvent('badge_unlocked', {});

      markSyncEventCompleted(e1.id);

      const pending = getPendingSyncEvents();
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(e2.id);
    });

    it('should clear the entire queue when requested', () => {
      enqueueSyncEvent('ai_match_completed', {});
      enqueueSyncEvent('settings_changed', {});

      expect(getPendingSyncEvents().length).toBe(2);

      clearSyncedEvents();

      expect(getPendingSyncEvents().length).toBe(0);
    });
  });

  describe('4. Local Player Store Access (localPlayerStore)', () => {
    it('should load local player data and save updates', () => {
      const defaultData = localPlayerStore.getDefaultData();
      expect(defaultData).toEqual(DEFAULT_PLAYER_DATA);

      // Save modified player data
      const customData = {
        ...defaultData,
        rating: 1420,
        coins: 888,
        aiProgress: {
          ...defaultData.aiProgress,
          elo: 1420
        }
      };

      localPlayerStore.saveLocalData(customData);

      // Load it back
      const loaded = localPlayerStore.loadLocalData();
      expect(loaded.rating).toBe(1420);
      expect(loaded.aiProgress.elo).toBe(1420);
      expect(loaded.coins).toBe(888);
    });
  });

  describe('5. Offline Package Caching & Downloading (offlinePackage)', () => {
    it('should return default not_downloaded status when no metadata exists', () => {
      const meta = getOfflinePackageMetadata();
      expect(meta.status).toBe('not_downloaded');
      expect(meta.offlinePackageVersion).toBeNull();
      expect(meta.downloadedAt).toBeNull();
      expect(meta.assetManifestHash).toBeNull();
    });

    it('should save and load offline package metadata correctly', () => {
      const meta: OfflinePackageMetadata = {
        status: 'downloaded',
        offlinePackageVersion: '2.0.0',
        downloadedAt: 123456789,
        assetManifestHash: 'hash_test_value'
      };

      saveOfflinePackageMetadata(meta);

      const loaded = getOfflinePackageMetadata();
      expect(loaded).toEqual(meta);
    });

    it('should simulate download when cache API is not available (Node testing environments)', async () => {
      const progressLogs: number[] = [];
      const result = await downloadOfflinePackage((p) => {
        progressLogs.push(p);
      });

      expect(result).toBe(true);
      expect(progressLogs.length).toBeGreaterThan(0);
      expect(progressLogs[progressLogs.length - 1]).toBe(100);

      const meta = getOfflinePackageMetadata();
      expect(meta.status).toBe('downloaded');
      expect(meta.offlinePackageVersion).toBe('1.0.0');
      expect(meta.downloadedAt).not.toBeNull();
      expect(meta.assetManifestHash).toBe('hash_v1_assets_core');
    });

    it('should work with mocked Cache API to test standard caching path', async () => {
      const mockCache = {
        put: vi.fn().mockResolvedValue(undefined),
      };
      
      const mockCaches = {
        open: vi.fn().mockResolvedValue(mockCache),
        delete: vi.fn().mockResolvedValue(true),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      // Inject mocks into global
      global.caches = mockCaches as any;
      global.fetch = mockFetch as any;

      const progressLogs: number[] = [];
      const result = await downloadOfflinePackage((p) => {
        progressLogs.push(p);
      });

      expect(result).toBe(true);
      expect(mockCaches.open).toHaveBeenCalledWith('clash-offline-assets');
      expect(mockFetch).toHaveBeenCalled();
      expect(progressLogs[progressLogs.length - 1]).toBe(100);

      // Clean up global mocks
      delete (global as any).caches;
      delete (global as any).fetch;
    });

    it('should support resetting the package and deleting the cache', async () => {
      const mockCaches = {
        delete: vi.fn().mockResolvedValue(true),
      };
      global.caches = mockCaches as any;

      // First set metadata to downloaded state
      saveOfflinePackageMetadata({
        status: 'downloaded',
        offlinePackageVersion: '1.0.0',
        downloadedAt: Date.now(),
        assetManifestHash: 'hash_v1_assets_core'
      });

      await resetOfflinePackage();

      expect(mockCaches.delete).toHaveBeenCalledWith('clash-offline-assets');
      const meta = getOfflinePackageMetadata();
      expect(meta.status).toBe('not_downloaded');
      expect(meta.offlinePackageVersion).toBeNull();

      delete (global as any).caches;
    });
  });
});
