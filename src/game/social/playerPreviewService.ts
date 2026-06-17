import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PlayerData } from '../../types';
import { PlayerPublicPreview } from './challengeTypes';
import { getMyCompRank } from '../leaderboard/compLeaderboardService';
import { getMyArenaRank } from '../leaderboard/arenaLeaderboardService';
import { LeaderboardEntry } from '../leaderboard/leaderboardTypes';

/**
 * Fetches the user's standing on both leaderboards.
 */
export async function getPlayerRanks(uid: string): Promise<{ compRank: number; arenaRank: number }> {
  try {
    const compRank = await getMyCompRank(uid);
    const arenaRank = await getMyArenaRank(uid);
    return { compRank, arenaRank };
  } catch (err) {
    console.warn('[playerPreviewService] Failed to fetch player ranks:', err);
    return { compRank: -1, arenaRank: -1 };
  }
}

/**
 * Retrieves the user profile and compiles a PlayerPublicPreview including rankings and stats.
 */
export async function getPlayerPublicPreview(uid: string): Promise<PlayerPublicPreview | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return null;
    }
    const data = userDocSnap.data() as PlayerData;
    const { compRank, arenaRank } = await getPlayerRanks(uid);

    const history = data.multiplayerHistory || [];
    const arenaMatches = history.length;
    const arenaWins = history.filter(h => h.result === 'win').length;
    const arenaLosses = history.filter(h => h.result === 'loss').length;
    const arenaDraws = history.filter(h => h.result === 'draw').length;
    const arenaWinRate = arenaMatches > 0 ? Math.round((arenaWins / arenaMatches) * 100) : 0;

    return {
      uid,
      name: data.name || 'Champion',
      compRank,
      arenaRank,
      compElo: data.aiProgress?.elo ?? data.rating ?? 1200,
      arenaRating: 1200,
      arenaWins,
      arenaLosses,
      arenaDraws,
      arenaWinRate,
      arenaMatches,
      badges: data.badges || [],
      photoURL: data.photoURL || undefined,
      lastActive: (data as any).lastActive || undefined
    };
  } catch (err) {
    console.error('[playerPreviewService] Failed to get player public preview:', err);
    return null;
  }
}

/**
 * Maps a LeaderboardEntry to a PlayerPublicPreview structure, supplying default values for missing statistics.
 */
export function buildPlayerPreviewFromLeaderboardEntry(entry: LeaderboardEntry): PlayerPublicPreview {
  const compElo = entry.compStats?.compElo ?? 1200;
  const arenaWins = entry.arenaStats?.arenaWins ?? 0;
  const arenaLosses = entry.arenaStats?.arenaLosses ?? 0;
  const arenaDraws = entry.arenaStats?.arenaDraws ?? 0;
  const arenaMatches = entry.arenaStats?.arenaMatches ?? 0;
  const arenaWinRate = entry.arenaStats?.arenaWinRate ?? 0;

  return {
    uid: entry.uid,
    name: entry.displayName,
    compRank: entry.mode === 'comp_kings' ? (entry.rank ?? -1) : -1,
    arenaRank: entry.mode === 'arena_kings' ? (entry.rank ?? -1) : -1,
    compElo,
    arenaRating: entry.arenaStats?.arenaRating ?? 1200,
    arenaWins,
    arenaLosses,
    arenaDraws,
    arenaWinRate,
    arenaMatches,
    badges: entry.badges || [],
    photoURL: entry.avatarUrl
  };
}
