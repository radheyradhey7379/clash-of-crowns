import { db, auth } from '../../firebase';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { ChallengeRequest, ChallengeType, ChallengeStatus } from './challengeTypes';
import { 
  validateChallengeTarget, 
  validateChallengeCooldown, 
  validateDailyChallengeLimit, 
  checkAndHandlePendingChallenge,
  sanitizeAndValidateMessage 
} from './challengeValidation';
import { createChallengeNotification } from './notificationService';
import { createChallengeChatMessage } from './chatInboxService';
import { LeaderboardMode } from '../leaderboard/leaderboardTypes';
import { isOnline } from '../../lib/offline/networkStatus';

/**
 * Sends a poke or challenge to another player.
 * Performs validation, creates the request, then creates notifications/inbox items non-blockingly.
 */
export async function sendPokeChallenge(
  targetUid: string,
  targetName: string,
  type: ChallengeType,
  fromMode: LeaderboardMode,
  fromRank?: number,
  message?: string
): Promise<{ success: boolean; reason?: string; challengeRequest?: ChallengeRequest }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, reason: 'Sender must be authenticated' };
  }
  const fromUid = currentUser.uid;
  const fromName = currentUser.displayName || 'Champion';

  // 1. Validate target
  const targetVal = validateChallengeTarget(fromUid, targetUid);
  if (!targetVal.valid) {
    return { success: false, reason: targetVal.reason };
  }

  // 2. Pending duplicate check & expire old duplicates if expired
  const pendingVal = await checkAndHandlePendingChallenge(fromUid, targetUid);
  if (!pendingVal) {
    return { success: false, reason: 'There is already an active pending challenge request to this player' };
  }

  // 3. Cooldown check
  const cooldownVal = await validateChallengeCooldown(fromUid, targetUid);
  if (!cooldownVal) {
    return { success: false, reason: 'You must wait 10 minutes before poking/challenging this player again' };
  }

  // 4. Daily limit check
  const dailyVal = await validateDailyChallengeLimit(fromUid);
  if (!dailyVal) {
    return { success: false, reason: 'Daily limit of 20 outgoing challenges reached' };
  }

  // Sanitize message
  const sanitizedMessage = sanitizeAndValidateMessage(message);

  // Create ChallengeRequest
  const challengeId = `chal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  const challengeRequest: ChallengeRequest = {
    id: challengeId,
    fromUid,
    toUid: targetUid,
    fromName,
    toName: targetName,
    fromRank,
    fromMode,
    type,
    mode: 'friendly_duel',
    status: 'pending',
    message: sanitizedMessage,
    createdAt: Date.now(),
    expiresAt
  };

  try {
    // Write ChallengeRequest to Firestore
    await setDoc(doc(db, 'challengeRequests', challengeId), challengeRequest);

    // Create notification (non-blocking)
    try {
      await createChallengeNotification(challengeRequest);
    } catch (err) {
      console.warn('[challengeService] Failed to create notification:', err);
    }

    // Create chat inbox item (non-blocking)
    try {
      await createChallengeChatMessage(challengeRequest);
    } catch (err) {
      console.warn('[challengeService] Failed to create chat inbox message:', err);
    }

    return { success: true, challengeRequest };
  } catch (err: any) {
    console.error('[challengeService] Failed to send challenge:', err);
    return { success: false, reason: err.message || 'Failed to submit challenge request' };
  }
}

/**
 * Retrieves challenge requests received by a specific user.
 */
export async function getReceivedChallenges(uid: string): Promise<ChallengeRequest[]> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('toUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const challenges: ChallengeRequest[] = [];
    const now = Date.now();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as ChallengeRequest;
      if (data.expiresAt < now && (data.status === 'pending' || data.status === 'seen')) {
        data.status = 'expired';
        // Proactively update in background
        updateDoc(doc(db, 'challengeRequests', docSnap.id), { status: 'expired' }).catch(() => {});
        updateInboxStatus(uid, docSnap.id, 'expired').catch(() => {});
      }
      challenges.push(data);
    }
    return challenges;
  } catch (err) {
    console.error('[challengeService] Failed to get received challenges:', err);
    return [];
  }
}

/**
 * Retrieves challenge requests sent by a specific user.
 */
export async function getSentChallenges(uid: string): Promise<ChallengeRequest[]> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('fromUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const challenges: ChallengeRequest[] = [];
    const now = Date.now();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as ChallengeRequest;
      if (data.expiresAt < now && (data.status === 'pending' || data.status === 'seen')) {
        data.status = 'expired';
        // Proactively update in background
        updateDoc(doc(db, 'challengeRequests', docSnap.id), { status: 'expired' }).catch(() => {});
        updateInboxStatus(data.toUid, docSnap.id, 'expired').catch(() => {});
      }
      challenges.push(data);
    }
    return challenges;
  } catch (err) {
    console.error('[challengeService] Failed to get sent challenges:', err);
    return [];
  }
}

/**
 * Marks a challenge request as seen.
 */
export async function markChallengeSeen(challengeId: string, uid: string): Promise<boolean> {
  try {
    const challengeRef = doc(db, 'challengeRequests', challengeId);
    const challengeDoc = await getDoc(challengeRef);
    if (!challengeDoc.exists()) {
      return false;
    }
    const data = challengeDoc.data() as ChallengeRequest;
    if (data.toUid !== uid) {
      return false;
    }

    if (data.status === 'pending') {
      await updateDoc(challengeRef, { status: 'seen' });
      await updateInboxStatus(uid, challengeId, 'seen');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[challengeService] Failed to mark challenge seen:', err);
    return false;
  }
}

/**
 * Accepts a challenge request, checking expiration first.
 */
export async function acceptChallenge(challengeId: string, uid: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const challengeRef = doc(db, 'challengeRequests', challengeId);
    const challengeDoc = await getDoc(challengeRef);
    if (!challengeDoc.exists()) {
      return { success: false, reason: 'Challenge does not exist' };
    }
    const data = challengeDoc.data() as ChallengeRequest;
    if (data.toUid !== uid) {
      return { success: false, reason: 'You are not the receiver of this challenge' };
    }

    // Expiry check
    if (data.expiresAt < Date.now() || data.status === 'expired') {
      try {
        await updateDoc(challengeRef, { status: 'expired' });
        await updateInboxStatus(uid, challengeId, 'expired');
      } catch (e) {}
      return { success: false, reason: 'Challenge has expired' };
    }

    if (data.status !== 'pending' && data.status !== 'seen') {
      return { success: false, reason: `Challenge is already in state: ${data.status}` };
    }

    await updateDoc(challengeRef, { status: 'accepted' });
    await updateInboxStatus(uid, challengeId, 'accepted');
    return { success: true };
  } catch (err: any) {
    console.error('[challengeService] Failed to accept challenge:', err);
    return { success: false, reason: err.message || 'Failed to accept challenge' };
  }
}

/**
 * Declines a challenge request.
 */
export async function declineChallenge(challengeId: string, uid: string): Promise<{ success: boolean; reason?: string }> {
  try {
    const challengeRef = doc(db, 'challengeRequests', challengeId);
    const challengeDoc = await getDoc(challengeRef);
    if (!challengeDoc.exists()) {
      return { success: false, reason: 'Challenge does not exist' };
    }
    const data = challengeDoc.data() as ChallengeRequest;
    if (data.toUid !== uid) {
      return { success: false, reason: 'You are not the receiver of this challenge' };
    }

    await updateDoc(challengeRef, { status: 'declined' });
    await updateInboxStatus(uid, challengeId, 'declined');
    return { success: true };
  } catch (err: any) {
    console.error('[challengeService] Failed to decline challenge:', err);
    return { success: false, reason: err.message || 'Failed to decline challenge' };
  }
}

/**
 * Helper function to synchronize status changes to the user's chatInbox subcollection.
 */
async function updateInboxStatus(uid: string, challengeId: string, status: ChallengeStatus) {
  try {
    const q = query(
      collection(db, 'users', uid, 'chatInbox'),
      where('challengeRequestId', '==', challengeId)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      await updateDoc(doc(db, 'users', uid, 'chatInbox', docSnap.id), { status });
    }
  } catch (e) {
    console.warn('[challengeService] Failed to update inbox status:', e);
  }
}

/**
 * Scans active pending challenges and marks them expired if expiresAt < now.
 */
export async function expireOldChallenges(): Promise<void> {
  try {
    const q = query(
      collection(db, 'challengeRequests'),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const now = Date.now();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as ChallengeRequest;
      if (data.expiresAt < now) {
        await updateDoc(doc(db, 'challengeRequests', docSnap.id), { status: 'expired' });
        await updateInboxStatus(data.toUid, docSnap.id, 'expired');
      }
    }
  } catch (err) {
    console.error('[challengeService] Failed to expire old challenges:', err);
  }
}
