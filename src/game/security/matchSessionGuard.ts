import { PlayerData } from '../../types';
import { isCharacterUnlocked } from '../ai/progressionEngine';

export interface MatchSession {
  matchId: string;
  characterId: string;
  startTime: number;
  status: 'active' | 'completed';
}

/**
 * Creates a new active match session and returns the generated match ID.
 */
export function createMatchSession(characterId: string): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return `match_${Date.now()}`;
  }

  const matchId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const session: MatchSession = {
    matchId,
    characterId,
    startTime: Date.now(),
    status: 'active'
  };

  localStorage.setItem('clash_active_match_session', JSON.stringify(session));
  return matchId;
}

/**
 * Validates match completion against active session and anti-cheat rules.
 */
export function validateMatchCompletion(
  matchId: string,
  characterId: string,
  result: 'win' | 'loss' | 'draw',
  playerData: PlayerData
): { valid: boolean; reason?: 'duplicate_match_result' | 'invalid_session' | 'locked_character_attempt' | 'too_fast_match' | 'too_fast_suspicious'; duration?: number } {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { valid: true };
  }

  // 1. Check duplicate rewards cache
  const completedJson = localStorage.getItem('clash_completed_matches');
  let completedIds: string[] = [];
  try {
    const parsed = completedJson ? JSON.parse(completedJson) : [];
    if (Array.isArray(parsed)) {
      completedIds = parsed.filter(id => typeof id === 'string');
    }
  } catch (e) {
    // Corrupt cache: Reset it to prevent bypass
    localStorage.setItem('clash_completed_matches', JSON.stringify([]));
  }

  if (completedIds.includes(matchId)) {
    return { valid: false, reason: 'duplicate_match_result' };
  }

  // 2. Check active session
  const sessionJson = localStorage.getItem('clash_active_match_session');
  if (!sessionJson) {
    return { valid: false, reason: 'invalid_session' };
  }

  let session: MatchSession;
  try {
    session = JSON.parse(sessionJson);
  } catch (e) {
    return { valid: false, reason: 'invalid_session' };
  }

  if (session.matchId !== matchId || session.characterId !== characterId) {
    return { valid: false, reason: 'invalid_session' };
  }

  if (session.status === 'completed') {
    return { valid: false, reason: 'duplicate_match_result' };
  }

  // 3. Verify character is unlocked for the player
  const isUnlocked = isCharacterUnlocked(characterId, playerData.aiProgress);
  if (!isUnlocked) {
    return { valid: false, reason: 'locked_character_attempt' };
  }

  // 4. Too-fast match duration check
  const duration = Date.now() - session.startTime;
  if (duration < 2000) {
    // Under 2 seconds: Block progression/rewards entirely
    return { valid: false, reason: 'too_fast_match', duration };
  }

  if (duration < 5000) {
    // Under 5 seconds (but >= 2s): Flag suspicious but allow match completion
    return { valid: true, reason: 'too_fast_suspicious', duration };
  }

  return { valid: true, duration };
}

/**
 * Marks the match ID as completed and caches it to prevent replay exploits.
 * Keeps only the last 200 completed match IDs.
 */
export function markMatchCompleted(matchId: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  // Add to completed cache
  const completedJson = localStorage.getItem('clash_completed_matches');
  let completedIds: string[] = [];
  try {
    const parsed = completedJson ? JSON.parse(completedJson) : [];
    if (Array.isArray(parsed)) {
      completedIds = parsed.filter(id => typeof id === 'string');
    }
  } catch (e) {
    // Corrupt cache: reset
    completedIds = [];
  }

  if (!completedIds.includes(matchId)) {
    completedIds.push(matchId);
  }

  // Cap at 200 completed matches
  if (completedIds.length > 200) {
    completedIds.shift();
  }

  localStorage.setItem('clash_completed_matches', JSON.stringify(completedIds));

  // Mark active session status as completed
  const sessionJson = localStorage.getItem('clash_active_match_session');
  if (sessionJson) {
    try {
      const session = JSON.parse(sessionJson);
      session.status = 'completed';
      localStorage.setItem('clash_active_match_session', JSON.stringify(session));
    } catch (e) {
      // ignore
    }
  }
}
