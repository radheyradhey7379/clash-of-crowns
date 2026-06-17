export interface SyncEvent {
  id: string;
  type: 'ai_match_completed' | 'rewards_granted' | 'tier_unlocked' | 'badge_unlocked' | 'settings_changed' | 'comp_leaderboard_update' | 'arena_leaderboard_update';
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = 'clash_offline_sync_queue';

function getQueue(): SyncEvent[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch (e) {
    return [];
  }
}

function saveQueue(queue: SyncEvent[]) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

/**
 * Pushes a new sync event onto the queue to be synchronized with the cloud later.
 */
export function enqueueSyncEvent(
  type: SyncEvent['type'],
  payload: any
): SyncEvent {
  const event: SyncEvent = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
  };

  const queue = getQueue();
  queue.push(event);
  saveQueue(queue);

  return event;
}

/**
 * Retrieves all pending sync events.
 */
export function getPendingSyncEvents(): SyncEvent[] {
  return getQueue();
}

/**
 * Removes a specific sync event from the queue after it has been synced successfully.
 */
export function markSyncEventCompleted(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter(event => event.id !== id);
  saveQueue(filtered);
}

/**
 * Clears all sync events.
 */
export function clearSyncedEvents(): void {
  saveQueue([]);
}
