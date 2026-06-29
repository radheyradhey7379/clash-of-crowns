import { db } from '../../firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { PlayerData } from '../../types';
import { LeaderboardEntry } from './leaderboardTypes';
import { calculateCompScore } from './leaderboardScore';
import { validatePlayerData } from '../security/validatePlayerData';
import { detectSuspiciousSave } from '../security/suspiciousSaveDetector';
import { isOnline } from '../../lib/offline/networkStatus';
import { enqueueSyncEvent } from '../../lib/offline/syncQueue';

const CACHE_KEY = 'clash_cache_comp_kings';

/**
 * Builds a Comp Kings LeaderboardEntry from PlayerData.
 */
export function buildCompLeaderboardEntry(uid: string, playerData: PlayerData): LeaderboardEntry {
  const compWins = playerData.wins || 0;
  const compLosses = playerData.losses || 0;
  const compDraws = playerData.draws || 0;

  return {
    uid,
    displayName: playerData.name || 'Champion',
    avatarUrl: playerData.photoURL,
    mode: 'comp_kings',
    score: calculateCompScore(playerData),
    badges: playerData.badges || [],
    updatedAt: Date.now(),
    compStats: {
      compElo: playerData.aiProgress?.elo ?? 1200,
      compTier: playerData.aiProgress?.tier || 'beginner',
      compWins,
      compMatches: compWins + compLosses + compDraws,
      compWinStreak: playerData.streak || 0,
      completedMasterCups: playerData.aiProgress?.masterCup?.completedCups?.length || 0,
      grandmasterDefeated: playerData.aiProgress?.grandmaster?.bossDefeated || false
    }
  };
}

import { MAX_COMP_LEADERBOARD_SCORE } from './leaderboardTypes';

/**
 * Uploads a Comp Kings leaderboard entry if online.
 * Validates the player data first. If offline, enqueues the update safely.
 */
export async function uploadCompLeaderboardEntry(uid: string, playerData: PlayerData): Promise<boolean> {
  // Validate playerData first
  if (!validatePlayerData(playerData)) {
    console.warn('[compLeaderboardService] Player data validation failed. Upload rejected.');
    return false;
  }

  // Phase 32B Leaderboard Protection
  const detection = detectSuspiciousSave(playerData);
  if (detection.shouldBlockLeaderboardUpload) {
    console.warn('[compLeaderboardService] Suspicious save detected. Blocking leaderboard upload.');
    return false; // Safely drop update
  }

  const entry = buildCompLeaderboardEntry(uid, playerData);

  // Security Hardening: Reject impossible scores
  if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > MAX_COMP_LEADERBOARD_SCORE) {
    console.warn('[compLeaderboardService] Invalid score detected. Upload rejected.', entry.score);
    return false;
  }

  if (!isOnline()) {
    console.log('[compLeaderboardService] Offline. Enqueuing comp leaderboard update.');
    enqueueSyncEvent('comp_leaderboard_update', { uid, playerData });
    return true;
  }

  try {
    const entryRef = doc(db, 'leaderboards', 'comp_kings', 'entries', uid);
    await setDoc(entryRef, entry);
    console.log('[compLeaderboardService] Successfully uploaded comp leaderboard entry.');
    return true;
  } catch (err) {
    console.warn('[compLeaderboardService] Upload failed, enqueuing for retry:', err);
    enqueueSyncEvent('comp_leaderboard_update', { uid, playerData });
    return false;
  }
}

/**
 * Fetches top Comp Kings players. Uses and updates local cache.
 */
export async function getTopCompKings(limitNumber = 20): Promise<LeaderboardEntry[]> {
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
      collection(db, 'leaderboards', 'comp_kings', 'entries'),
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
    console.warn('[compLeaderboardService] Failed to fetch top comp kings:', err);
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
 * Gets the rank of a specific player on the Comp Kings leaderboard.
 */
export async function getMyCompRank(uid: string): Promise<number> {
  if (!isOnline()) {
    return -1;
  }

  try {
    const myEntryDoc = await getDoc(doc(db, 'leaderboards', 'comp_kings', 'entries', uid));
    if (!myEntryDoc.exists()) {
      return -1;
    }
    const myScore = myEntryDoc.data().score;

    const q = query(
      collection(db, 'leaderboards', 'comp_kings', 'entries'),
      where('score', '>', myScore)
    );
    const countSnap = await getCountFromServer(q);
    return countSnap.data().count + 1;
  } catch (err) {
    console.warn('[compLeaderboardService] Failed to get comp rank:', err);
    return -1;
  }
}
