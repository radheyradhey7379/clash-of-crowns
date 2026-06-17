import { PlayerData } from '../../types';
import { realtimeClient } from '../../services/realtime/realtimeClient';
import { isRankedArenaEnabled } from '../../lib/config/featureFlags';

export interface VerifiedRankedResult {
  room_id: string;
  ranked_match_id: string;
  result: string; // "white_win" | "black_win" | "draw" | "abandoned"
  reason: string;
  move_count: number;
  duration_ms: number;
  rating_delta_white: number;
  rating_delta_black: number;
  new_rating_white: number;
  new_rating_black: number;
  verification_hash: string;
}

/**
 * Starts a ranked arena session by connecting the WebSocket client.
 */
export function startRankedArenaSession(roomId: string, mode: 'friend' | 'ranked_arena', uid: string, displayName: string, rating: number, token?: string) {
  if (!isRankedArenaEnabled()) {
    console.warn('[arenaRankedService] Ranked arena is disabled for v1.0. Returning feature_disabled.');
    return;
  }

  const url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_WS_URL) || 'ws://localhost:3001/ws';
  realtimeClient.connectRealtime(url, {
    uid,
    displayName,
    rating,
    token,
  });
}

/**
 * Submits the local match result to the Rust authority.
 */
export function submitRankedResultToRust(roomId: string, result: string, reason: string) {
  realtimeClient.sendMessage({
    type: 'submit_result',
    room_id: roomId,
    result,
    reason,
  });
}

/**
 * Calls the secure Node.js server API to verify and apply ELO adjustments.
 */
export async function submitVerifiedResultToServer(
  verifiedResult: VerifiedRankedResult,
  idToken: string
): Promise<{ success: boolean; newRating?: number; ratingDelta?: number; error?: string }> {
  try {
    const httpUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_HTTP_URL) || 'http://localhost:3000';
    const res = await fetch(`${httpUrl}/api/ranked/verify-and-apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        roomId: verifiedResult.room_id,
        rankedMatchId: verifiedResult.ranked_match_id,
        whiteUid: (verifiedResult as any).white_uid || '',
        blackUid: (verifiedResult as any).black_uid || '',
        result: verifiedResult.result,
        reason: verifiedResult.reason,
        moveCount: verifiedResult.move_count,
        timestamp: (verifiedResult as any).timestamp || Date.now(),
        verificationHash: verifiedResult.verification_hash
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, newRating: data.newRating, ratingDelta: data.ratingDelta };
    } else {
      const errData = await res.json();
      return { success: false, error: errData.error || 'Failed to apply rating' };
    }
  } catch (err: any) {
    console.error('[arenaRankedService] Error submitting verified result:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Applies a verified ranked result to update the PlayerData and Firestore leaderboard.
 * Enforces deduplication using appliedArenaResultIds.
 */
export function applyVerifiedArenaLeaderboardUpdate(
  playerData: PlayerData,
  verifiedResult: VerifiedRankedResult,
  myColor: 'w' | 'b',
  newRating?: number,
  ratingDelta?: number
): { updatedData: PlayerData; success: boolean } {
  // 1. Missing verified result -> no update
  if (!verifiedResult || !verifiedResult.ranked_match_id) {
    console.warn('[arenaRankedService] Missing or invalid verified result');
    return { updatedData: playerData, success: false };
  }

  const matchId = verifiedResult.ranked_match_id;
  const appliedIds = playerData.appliedArenaResultIds || [];

  // 2. Duplicate verified result -> ignore
  if (appliedIds.includes(matchId)) {
    console.warn('[arenaRankedService] Duplicate verified result ignored:', matchId);
    return { updatedData: playerData, success: false };
  }

  // 3. Compute rating delta
  const delta = ratingDelta !== undefined ? ratingDelta : (myColor === 'w' ? verifiedResult.rating_delta_white : verifiedResult.rating_delta_black);
  const oldRating = playerData.arenaRating ?? 1200;
  let finalRating = newRating !== undefined ? newRating : oldRating + delta;
  
  if (finalRating < 100) {
    finalRating = 100;
  }

  const updatedHistory = [...(playerData.multiplayerHistory || [])];
  
  // Map result for history: "win" | "loss" | "draw"
  let matchOutcome: 'win' | 'loss' | 'draw' = 'draw';
  if (verifiedResult.result === 'white_win') {
    matchOutcome = myColor === 'w' ? 'win' : 'loss';
  } else if (verifiedResult.result === 'black_win') {
    matchOutcome = myColor === 'w' ? 'loss' : 'win';
  }

  updatedHistory.push({
    roomId: verifiedResult.room_id,
    opponentUid: myColor === 'w' ? ((verifiedResult as any).black_uid || 'opponent') : ((verifiedResult as any).white_uid || 'opponent'),
    opponentName: 'Arena Opponent',
    result: matchOutcome,
    reason: verifiedResult.reason as any,
    playedAt: (verifiedResult as any).timestamp || Date.now(),
    moves: verifiedResult.move_count,
  });

  const updatedData: PlayerData = {
    ...playerData,
    arenaRating: finalRating,
    appliedArenaResultIds: [...appliedIds, matchId],
    multiplayerHistory: updatedHistory,
  };

  // Note: Direct client-side write is blocked to protect leaderboard. 
  // Updates to the leaderboard are written by the Node.js server using Admin SDK.

  return { updatedData, success: true };
}
