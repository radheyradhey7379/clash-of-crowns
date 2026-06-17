import { db, auth } from '../../firebase';
import { doc, setDoc, collection, getDocs, updateDoc, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { ChallengeRequest, ChatInboxMessage } from './challengeTypes';

/**
 * Creates a challenge message in the target user's chatInbox subcollection.
 */
export async function createChallengeChatMessage(challengeRequest: ChallengeRequest): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('[chatInboxService] Unauthenticated user cannot create chat inbox messages.');
    return false;
  }

  // Cross-user write validations
  if (challengeRequest.fromUid !== currentUser.uid) {
    console.error('[chatInboxService] challengerUid must match authenticated user.');
    return false;
  }
  if (!challengeRequest.toUid) {
    console.error('[chatInboxService] target toUid is required.');
    return false;
  }
  if (challengeRequest.fromUid === challengeRequest.toUid) {
    console.error('[chatInboxService] Cannot create chatInbox message to self.');
    return false;
  }
  if (!challengeRequest.id) {
    console.error('[chatInboxService] challengeRequestId must exist.');
    return false;
  }

  try {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const actionWord = challengeRequest.type === 'poke' ? 'poked' : 'challenged';
    const rankText = challengeRequest.fromRank !== undefined ? ` Rank #${challengeRequest.fromRank}` : '';
    const modeLabel = challengeRequest.fromMode === 'comp_kings' ? 'Comp Kings' : 'Arena Kings';
    const messageText = `${challengeRequest.fromName} ${actionWord} you to a Friendly Duel from ${modeLabel}${rankText}.`;

    const chatInboxItem: ChatInboxMessage = {
      id: messageId,
      challengerUid: challengeRequest.fromUid,
      challengerName: challengeRequest.fromName,
      toUid: challengeRequest.toUid,
      fromMode: challengeRequest.fromMode,
      rank: challengeRequest.fromRank,
      challengeRequestId: challengeRequest.id,
      message: messageText,
      type: 'challenge_request',
      status: challengeRequest.status,
      read: false,
      createdAt: Date.now()
    };

    const msgRef = doc(db, 'users', challengeRequest.toUid, 'chatInbox', messageId);
    await setDoc(msgRef, chatInboxItem);
    return true;
  } catch (err) {
    console.error('[chatInboxService] Failed to create challenge chat inbox item:', err);
    return false;
  }
}

/**
 * Retrieves the chatInbox messages for a specific user.
 */
export async function getChatInbox(uid: string): Promise<ChatInboxMessage[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'chatInbox'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const messages: ChatInboxMessage[] = [];
    const now = Date.now();
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as ChatInboxMessage;
      // Challenge requests expire after 24 hours
      if (data.type === 'challenge_request' && data.createdAt + 24 * 60 * 60 * 1000 < now && (data.status === 'pending' || data.status === 'seen')) {
        data.status = 'expired';
        // Proactively update in background
        updateDoc(doc(db, 'users', uid, 'chatInbox', docSnap.id), { status: 'expired' }).catch(() => {});
      }
      messages.push(data);
    }
    return messages;
  } catch (err) {
    console.error('[chatInboxService] Failed to get chat inbox messages:', err);
    return [];
  }
}

/**
 * Marks a chatInbox message document as read.
 */
export async function markChatMessageRead(uid: string, messageId: string): Promise<boolean> {
  try {
    const msgRef = doc(db, 'users', uid, 'chatInbox', messageId);
    await updateDoc(msgRef, { read: true });
    return true;
  } catch (err) {
    console.error('[chatInboxService] Failed to mark chat message read:', err);
    return false;
  }
}

/**
 * Subscribes to real-time updates of a user's chatInbox.
 */
export function subscribeToChatInbox(uid: string, callback: (messages: ChatInboxMessage[]) => void): () => void {
  const q = query(
    collection(db, 'users', uid, 'chatInbox'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const messages: ChatInboxMessage[] = [];
    const now = Date.now();
    snap.forEach(docSnap => {
      const data = docSnap.data() as ChatInboxMessage;
      if (data.type === 'challenge_request' && data.createdAt + 24 * 60 * 60 * 1000 < now && (data.status === 'pending' || data.status === 'seen')) {
        data.status = 'expired';
        updateDoc(doc(db, 'users', uid, 'chatInbox', docSnap.id), { status: 'expired' }).catch(() => {});
      }
      messages.push(data);
    });
    callback(messages);
  }, (err) => {
    console.error('[chatInboxService] Error subscribing to chat inbox:', err);
  });
}

/**
 * Updates receiver's inbox message and creates one for the challenger.
 */
export async function updateChallengeInboxOnAccept(
  challengeRequest: ChallengeRequest,
  roomId: string
): Promise<boolean> {
  try {
    // 1. Find the receiver's chatInbox item referencing this challengeId
    const receiverUid = challengeRequest.toUid;
    const q = query(
      collection(db, 'users', receiverUid, 'chatInbox'),
      where('challengeRequestId', '==', challengeRequest.id)
    );
    const snap = await getDocs(q);
    
    // Update receiver's inbox message(s)
    for (const docSnap of snap.docs) {
      const msgRef = doc(db, 'users', receiverUid, 'chatInbox', docSnap.id);
      await updateDoc(msgRef, {
        status: 'accepted',
        roomId,
        actionLabel: 'Enter Match'
      });
    }

    // 2. Create a chatInbox item for the challenger (fromUid)
    const challengerUid = challengeRequest.fromUid;
    const msgId = `msg_accept_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const challengerMessageText = `Your challenge to ${challengeRequest.toName || 'Guest'} has been accepted! Friendly Duel room is ready.`;

    const challengerInboxItem: ChatInboxMessage = {
      id: msgId,
      challengerUid,
      challengerName: challengeRequest.fromName,
      toUid: challengerUid,
      fromMode: challengeRequest.fromMode,
      rank: challengeRequest.fromRank,
      challengeRequestId: challengeRequest.id,
      message: challengerMessageText,
      type: 'challenge_request',
      status: 'accepted',
      read: false,
      createdAt: Date.now(),
      roomId,
      actionLabel: 'Enter Match'
    };

    const challengerMsgRef = doc(db, 'users', challengerUid, 'chatInbox', msgId);
    await setDoc(challengerMsgRef, challengerInboxItem);

    return true;
  } catch (err) {
    console.error('[chatInboxService] Failed to update chat inbox on accept:', err);
    return false;
  }
}
