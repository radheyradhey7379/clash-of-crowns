import { db } from '../../firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { PlayerData } from '../../types';
import { LeaderboardEntry } from './leaderboardTypes';
import { calculateArenaScore } from './leaderboardScore';
import { validatePlayerData } from '../security/validatePlayerData';
import { isOnline } from '../../lib/offline/networkStatus';
import { enqueueSyncEvent } from '../../lib/offline/syncQueue';

const CACHE_KEY = 'clash_cache_arena_kings';

/**
 * Builds an Arena Kings LeaderboardEntry from PlayerData and multiplayerHistory.
 */
export function buildArenaLeaderboardEntry(uid: string, playerData: PlayerData): LeaderboardEntry {
  const history = playerData.multiplayerHistory || [];
  const arenaMatches = history.length;
  const arenaWins = history.filter(h => h.result === 'win').length;
  const arenaLosses = history.filter(h => h.result === 'loss').length;
  const arenaDraws = history.filter(h => h.result === 'draw').length;
  
  const winRatePercent = arenaMatches > 0 ? Math.round((arenaWins / arenaMatches) * 100) : 0;

  return {
    uid,
    displayName: playerData.name || 'Champion',
    avatarUrl: playerData.photoURL,
    mode: 'arena_kings',
    score: calculateArenaScore(playerData),
    badges: playerData.badges || [],
    updatedAt: Date.now(),
    arenaStats: {
      arenaRating: playerData.arenaRating ?? 1200,
      arenaWins,
      arenaLosses,
      arenaDraws,
      arenaWinRate: winRatePercent,
      arenaMatches
    }
  };
}

import { isRankedArenaEnabled } from '../../lib/config/featureFlags';

/**
 * Uploads an Arena Kings leaderboard entry if online.
 * Validates the player data first. If offline, enqueues the update safely.
 */
export async function uploadArenaLeaderboardEntry(uid: string, playerData: PlayerData): Promise<boolean> {
  if (!isRankedArenaEnabled()) {
    console.warn('[arenaLeaderboardService] Ranked arena is disabled for v1.0. Upload blocked safely.');
    return false; // Safely drop update
  }

  // Validate playerData first
  if (!validatePlayerData(playerData)) {
    console.warn('[arenaLeaderboardService] Player data validation failed. Upload rejected.');
    return false;
  }

  const entry = buildArenaLeaderboardEntry(uid, playerData);

  if (!isOnline()) {
    console.log('[arenaLeaderboardService] Offline. Enqueuing arena leaderboard update.');
    enqueueSyncEvent('arena_leaderboard_update', { uid, playerData });
    return true;
  }

  try {
    const entryRef = doc(db, 'leaderboards', 'arena_kings', 'entries', uid);
    await setDoc(entryRef, entry);
    console.log('[arenaLeaderboardService] Successfully uploaded arena leaderboard entry.');
    return true;
  } catch (err) {
    console.warn('[arenaLeaderboardService] Upload failed, enqueuing for retry:', err);
    enqueueSyncEvent('arena_leaderboard_update', { uid, playerData });
    return false;
  }
}

/**
 * Fetches top Arena Kings players. Uses and updates local cache.
 */
export async function getTopArenaKings(limitNumber = 20): Promise<LeaderboardEntry[]> {
  if (!isOnline()) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    throw new Error('Offline and no cache available');
  }

  try {
    const q = query(
      collection(db, 'leaderboards', 'arena_kings', 'entries'),
      orderBy('score', 'desc'),
      limit(limitNumber)
    );
    const snap = await getDocs(q);
    const entries: LeaderboardEntry[] = [];
    snap.forEach((docSnap) => {
      entries.push(docSnap.data() as LeaderboardEntry);
    });

    // Save to cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    return entries;
  } catch (err) {
    console.warn('[arenaLeaderboardService] Failed to fetch top arena kings:', err);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    throw err;
  }
}

/**
 * Gets the rank of a specific player on the Arena Kings leaderboard.
 */
export async function getMyArenaRank(uid: string): Promise<number> {
  if (!isOnline()) {
    return -1;
  }

  try {
    const myEntryDoc = await getDoc(doc(db, 'leaderboards', 'arena_kings', 'entries', uid));
    if (!myEntryDoc.exists()) {
      return -1;
    }
    const myScore = myEntryDoc.data().score;

    const q = query(
      collection(db, 'leaderboards', 'arena_kings', 'entries'),
      where('score', '>', myScore)
    );
    const countSnap = await getCountFromServer(q);
    return countSnap.data().count + 1;
  } catch (err) {
    console.warn('[arenaLeaderboardService] Failed to get arena rank:', err);
    return -1;
  }
}
