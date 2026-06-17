import { isOnline, subscribeToNetworkChanges } from '../offline/networkStatus';
import { getPendingSyncEvents, markSyncEventCompleted, clearSyncedEvents } from '../offline/syncQueue';
import { getCloudSave, uploadCloudSave } from './cloudSaveService';
import { resolveCloudVsLocal } from './cloudConflictResolver';
import { localPlayerStore } from '../offline/localPlayerStore';
import { auth, onAuthStateChanged } from '../firebase';
import { PlayerData } from '../../types';
import { uploadCompLeaderboardEntry } from '../../game/leaderboard/compLeaderboardService';
import { uploadArenaLeaderboardEntry } from '../../game/leaderboard/arenaLeaderboardService';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline' | 'unauthenticated';

let syncStatus: SyncStatus = 'unauthenticated';
let pendingEventsCount = 0;
let lastSyncedChecksum = '';
let lastSyncedTime = 0;

let intervalId: any = null;
let debounceTimeoutId: any = null;
let isAppActive = true;

const statusListeners = new Set<(status: SyncStatus) => void>();
const countListeners = new Set<(count: number) => void>();
let onLocalDataChangedCallback: ((data: PlayerData) => void) | null = null;

function setStatus(status: SyncStatus) {
  syncStatus = status;
  statusListeners.forEach(listener => listener(status));
}

function updatePendingCount() {
  pendingEventsCount = getPendingSyncEvents().length;
  countListeners.forEach(listener => listener(pendingEventsCount));
}

/**
 * Initializes listeners for network, auth, and page visibility changes.
 */
export function initializeSyncManager() {
  if (typeof window === 'undefined') return;

  // 1. Visibility tracking
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseSync();
    } else {
      resumeSync();
    }
  });

  // 2. Network changes
  subscribeToNetworkChanges((online) => {
    if (!online) {
      setStatus('offline');
    } else {
      if (auth.currentUser) {
        setStatus('idle');
        triggerDebouncedSync();
      } else {
        setStatus('unauthenticated');
      }
    }
    updatePendingCount();
  });

  // 3. Auth changes
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setStatus('idle');
      scheduleBackgroundSync();
      triggerDebouncedSync();
    } else {
      setStatus('unauthenticated');
      pauseSync();
    }
    updatePendingCount();
  });
}

/**
 * Subscribes to sync status changes.
 */
export function subscribeToSyncStatus(callback: (status: SyncStatus) => void): () => void {
  statusListeners.add(callback);
  callback(syncStatus);
  return () => {
    statusListeners.delete(callback);
  };
}

/**
 * Subscribes to pending sync event count changes.
 */
export function subscribeToPendingCount(callback: (count: number) => void): () => void {
  countListeners.add(callback);
  callback(pendingEventsCount);
  return () => {
    countListeners.delete(callback);
  };
}

/**
 * Registers a callback to be invoked when local player data is updated from a cloud merge or restore.
 */
export function registerLocalDataChangedListener(callback: (data: PlayerData) => void) {
  onLocalDataChangedCallback = callback;
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function getPendingCount(): number {
  pendingEventsCount = getPendingSyncEvents().length;
  return pendingEventsCount;
}

/**
 * Triggers a debounced sync after 5 seconds to batched writes.
 */
export function triggerDebouncedSync() {
  if (!isOnline()) {
    setStatus('offline');
    return;
  }
  if (!auth.currentUser) {
    setStatus('unauthenticated');
    return;
  }

  if (debounceTimeoutId) {
    clearTimeout(debounceTimeoutId);
  }

  debounceTimeoutId = setTimeout(() => {
    syncNow();
  }, 5000);
}

/**
 * Uploads leaderboard entries non-blockingly for both Comp Kings and Arena Kings.
 */
function uploadLeaderboardEntriesNonBlocking(uid: string, data: PlayerData) {
  uploadCompLeaderboardEntry(uid, data).catch(err => {
    console.warn('[CloudSyncManager] Non-blocking comp leaderboard upload failed:', err);
  });
  uploadArenaLeaderboardEntry(uid, data).catch(err => {
    console.warn('[CloudSyncManager] Non-blocking arena leaderboard upload failed:', err);
  });
}

/**
 * Executes a sync operation immediately.
 * Compares local vs cloud save and performs upload or merge.
 */
export async function syncNow(): Promise<boolean> {
  if (!isOnline()) {
    setStatus('offline');
    return false;
  }
  const user = auth.currentUser;
  if (!user) {
    setStatus('unauthenticated');
    return false;
  }
  if (!isAppActive) {
    return false;
  }
  if (syncStatus === 'syncing') {
    return false;
  }

  setStatus('syncing');

  try {
    const localData = localPlayerStore.loadLocalData();
    const primaryJson = localStorage.getItem('clash_player_data');
    let localChecksum = '';
    let localUpdatedAt = 0;

    if (primaryJson) {
      try {
        const parsed = JSON.parse(primaryJson);
        localChecksum = parsed.checksum || '';
        localUpdatedAt = parsed.updatedAt || 0;
      } catch (e) {}
    }

    // Fetch cloud document
    const cloudRes = await getCloudSave(user.uid);
    if (!cloudRes.success) {
      console.warn('[CloudSyncManager] Failed to fetch cloud save:', cloudRes.error);
      setStatus('failed');
      return false;
    }

    const cloudSave = cloudRes.data;

    // No cloud save exists -> Initial upload of local save
    if (!cloudSave) {
      const uploadRes = await uploadCloudSave(user.uid, localData);
      if (uploadRes.success) {
        lastSyncedChecksum = localChecksum;
        lastSyncedTime = localUpdatedAt;
        clearSyncedEvents(); // Clear local sync queue
        setStatus('synced');
        updatePendingCount();
        uploadLeaderboardEntriesNonBlocking(user.uid, localData);
        return true;
      } else {
        setStatus('failed');
        return false;
      }
    }

    // Cloud save exists -> Resolve conflict
    const { action, resolvedData } = resolveCloudVsLocal(
      localData,
      localUpdatedAt,
      cloudSave.playerData,
      cloudSave.updatedAt
    );

    if (action === 'upload_local') {
      const uploadRes = await uploadCloudSave(user.uid, localData);
      if (uploadRes.success) {
        lastSyncedChecksum = localChecksum;
        lastSyncedTime = localUpdatedAt;
        clearSyncedEvents();
        setStatus('synced');
        updatePendingCount();
        uploadLeaderboardEntriesNonBlocking(user.uid, localData);
        return true;
      } else {
        setStatus('failed');
        return false;
      }
    } else if (action === 'restore_cloud' || action === 'merge') {
      // Save resolved merged data to local storage
      localPlayerStore.saveLocalData(resolvedData);

      // Re-load to capture the newly signed local checksum/updatedAt
      const newJson = localStorage.getItem('clash_player_data');
      let newChecksum = '';
      let newUpdatedAt = 0;
      if (newJson) {
        try {
          const parsed = JSON.parse(newJson);
          newChecksum = parsed.checksum || '';
          newUpdatedAt = parsed.updatedAt || 0;
        } catch (e) {}
      }

      // Upload the newly merged player data to align cloud state
      const uploadRes = await uploadCloudSave(user.uid, resolvedData);
      if (uploadRes.success) {
        lastSyncedChecksum = newChecksum;
        lastSyncedTime = newUpdatedAt;
        clearSyncedEvents();
        setStatus('synced');
        updatePendingCount();
        uploadLeaderboardEntriesNonBlocking(user.uid, resolvedData);

        // Update local React UI state
        if (onLocalDataChangedCallback) {
          onLocalDataChangedCallback(resolvedData);
        }
        return true;
      } else {
        setStatus('failed');
        return false;
      }
    } else {
      // action === 'keep_local_log_conflict'
      console.warn('[CloudSyncManager] Conflict unresolved. Keeping local data.');
      setStatus('failed');
      return false;
    }
  } catch (err) {
    console.error('[CloudSyncManager] Error during syncNow:', err);
    setStatus('failed');
    return false;
  }
}

/**
 * Schedules the 60-second periodic background sync interval.
 */
export function scheduleBackgroundSync() {
  if (intervalId) return;

  intervalId = setInterval(async () => {
    if (!isAppActive || !isOnline() || !auth.currentUser) {
      return;
    }

    const pendingEvents = getPendingSyncEvents();
    const primaryJson = localStorage.getItem('clash_player_data');
    let localChecksum = '';

    if (primaryJson) {
      try {
        const parsed = JSON.parse(primaryJson);
        localChecksum = parsed.checksum || '';
      } catch (e) {}
    }

    const localSaveChanged = localChecksum !== lastSyncedChecksum;

    if (pendingEvents.length > 0 || localSaveChanged) {
      console.log('[CloudSyncManager] Periodic background sync running...');
      await syncNow();
    }
  }, 60000);
}

/**
 * Pauses background sync intervals when app moves to background.
 */
export function pauseSync() {
  isAppActive = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Resumes background sync intervals when app returns to foreground.
 */
export function resumeSync() {
  isAppActive = true;
  scheduleBackgroundSync();
  triggerDebouncedSync();
}
