import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * Validates that the target is not the user themselves and UIDs are valid.
 */
export function validateChallengeTarget(fromUid: string | null | undefined, toUid: string | null | undefined): { valid: boolean; reason?: string } {
  if (!fromUid) {
    return { valid: false, reason: 'Sender must be authenticated' };
  }
  if (!toUid) {
    return { valid: false, reason: 'Target player required' };
  }
  if (fromUid === toUid) {
    return { valid: false, reason: 'You cannot poke or challenge yourself' };
  }
  return { valid: true };
}

/**
 * Ensures there are no active pending challenge requests between this sender and target.
 * If an existing pending request is expired, it updates it to 'expired' and permits a new challenge.
 */
export async function checkAndHandlePendingChallenge(fromUid: string, toUid: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('fromUid', '==', fromUid),
      where('toUid', '==', toUid)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return true;
    }

    let hasActivePending = false;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const status = data.status;
      if (status === 'pending' || status === 'seen') {
        if (data.expiresAt < Date.now()) {
          // Expire the old request
          try {
            await updateDoc(doc(db, 'challengeRequests', docSnap.id), { status: 'expired' });
          } catch (e) {
            console.warn('[challengeValidation] Failed to mark expired challenge:', e);
          }
        } else {
          hasActivePending = true;
        }
      }
    }

    return !hasActivePending;
  } catch (err) {
    console.error('[challengeValidation] Error checking pending duplicate:', err);
    // On query failure (e.g. offline/permission), allow check so we don't block gameplay
    return true;
  }
}

/**
 * Checks if the 10-minute cooldown per target is satisfied.
 */
export async function validateChallengeCooldown(fromUid: string, toUid: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('fromUid', '==', fromUid),
      where('toUid', '==', toUid)
    );
    const snap = await getDocs(q);
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const recent = snap.docs.some(docSnap => {
      const data = docSnap.data();
      return data.createdAt >= tenMinutesAgo;
    });

    return !recent;
  } catch (err) {
    console.error('[challengeValidation] Error checking cooldown:', err);
    return true;
  }
}

/**
 * Checks if the daily outgoing challenge limit (20 per 24 hours) is satisfied.
 */
export async function validateDailyChallengeLimit(fromUid: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('fromUid', '==', fromUid)
    );
    const snap = await getDocs(q);
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    const dailyChallenges = snap.docs.filter(docSnap => {
      const data = docSnap.data();
      return data.createdAt >= twentyFourHoursAgo;
    });

    return dailyChallenges.length < 20;
  } catch (err) {
    console.error('[challengeValidation] Error checking daily limit:', err);
    return true;
  }
}

/**
 * Validates a message: trims it, caps length to 120, blocks URLs, and sets fallback if empty.
 */
export function sanitizeAndValidateMessage(msg: string | null | undefined): string {
  const fallback = 'I challenge you to a friendly match of chess! May the best strategist win!';
  if (!msg) return fallback;
  
  let cleanMsg = msg.trim();
  if (cleanMsg.length === 0) {
    return fallback;
  }

  // Cap at 120 characters
  if (cleanMsg.length > 120) {
    cleanMsg = cleanMsg.substring(0, 120).trim();
  }

  // Block links / URLs
  const urlRegex = /(https?:\/\/|www\b|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i;
  if (urlRegex.test(cleanMsg)) {
    return fallback;
  }

  return cleanMsg;
}

/**
 * Basic payload validation.
 */
export function validateChallengePayload(payload: any): boolean {
  if (!payload) return false;
  if (typeof payload.id !== 'string' || !payload.id) return false;
  if (typeof payload.fromUid !== 'string' || !payload.fromUid) return false;
  if (typeof payload.toUid !== 'string' || !payload.toUid) return false;
  if (typeof payload.fromName !== 'string' || !payload.fromName) return false;
  if (payload.type !== 'poke' && payload.type !== 'challenge') return false;
  if (payload.mode !== 'friendly_duel') return false;
  if (typeof payload.createdAt !== 'number') return false;
  if (typeof payload.expiresAt !== 'number') return false;
  return true;
}
