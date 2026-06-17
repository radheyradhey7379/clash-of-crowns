import { db, auth } from '../../firebase';
import { doc, setDoc, collection, getDocs, updateDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { ChallengeRequest, ChatNotification } from './challengeTypes';

/**
 * Creates a challenge request notification in the target user's notifications subcollection.
 */
export async function createChallengeNotification(challengeRequest: ChallengeRequest): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('[notificationService] Unauthenticated user cannot create notifications.');
    return false;
  }

  // Cross-user write validations
  if (challengeRequest.fromUid !== currentUser.uid) {
    console.error('[notificationService] fromUid must match authenticated user.');
    return false;
  }
  if (!challengeRequest.toUid) {
    console.error('[notificationService] target toUid is required.');
    return false;
  }
  if (challengeRequest.fromUid === challengeRequest.toUid) {
    console.error('[notificationService] Cannot create notification to self.');
    return false;
  }
  if (!challengeRequest.id) {
    console.error('[notificationService] challengeRequestId must exist.');
    return false;
  }

  try {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const title = challengeRequest.type === 'poke' ? 'New Poke' : 'New Challenge';
    const actionWord = challengeRequest.type === 'poke' ? 'poked' : 'challenged';
    const message = `${challengeRequest.fromName} has ${actionWord} you to a friendly duel!`;

    const notification: ChatNotification = {
      id: notificationId,
      type: 'challenge_request',
      fromUid: challengeRequest.fromUid,
      toUid: challengeRequest.toUid,
      title,
      message,
      challengeRequestId: challengeRequest.id,
      read: false,
      createdAt: Date.now()
    };

    const notifRef = doc(db, 'users', challengeRequest.toUid, 'notifications', notificationId);
    await setDoc(notifRef, notification);
    return true;
  } catch (err) {
    console.error('[notificationService] Failed to create challenge notification:', err);
    return false;
  }
}

/**
 * Retrieves the notifications list for a specific user.
 */
export async function getUserNotifications(uid: string): Promise<ChatNotification[]> {
  try {
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const notifications: ChatNotification[] = [];
    snap.forEach(docSnap => {
      notifications.push(docSnap.data() as ChatNotification);
    });
    return notifications;
  } catch (err) {
    console.error('[notificationService] Failed to get user notifications:', err);
    return [];
  }
}

/**
 * Marks a notification document as read.
 */
export async function markNotificationRead(uid: string, notificationId: string): Promise<boolean> {
  try {
    const notifRef = doc(db, 'users', uid, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
    return true;
  } catch (err) {
    console.error('[notificationService] Failed to mark notification read:', err);
    return false;
  }
}

/**
 * Subscribes to real-time updates of a user's notification list.
 */
export function subscribeToNotifications(uid: string, callback: (notifications: ChatNotification[]) => void): () => void {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const notifications: ChatNotification[] = [];
    snap.forEach(docSnap => {
      notifications.push(docSnap.data() as ChatNotification);
    });
    callback(notifications);
  }, (err) => {
    console.error('[notificationService] Error subscribing to notifications:', err);
  });
}

/**
 * Creates room ready notifications for both the challenger (host) and the receiver (guest).
 */
export async function createRoomReadyNotifications(challengeRequest: ChallengeRequest, roomId: string): Promise<boolean> {
  try {
    const hostNotifId = `notif_host_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const guestNotifId = `notif_guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Challenger (Host) Notification
    const hostNotif: ChatNotification = {
      id: hostNotifId,
      type: 'challenge_request',
      fromUid: challengeRequest.toUid,
      toUid: challengeRequest.fromUid,
      title: 'Challenge Accepted',
      message: `${challengeRequest.toName || 'Guest'} accepted your challenge. Your Friendly Duel room is ready.`,
      challengeRequestId: challengeRequest.id,
      read: false,
      createdAt: Date.now()
    };

    // Receiver (Guest) Notification
    const guestNotif: ChatNotification = {
      id: guestNotifId,
      type: 'challenge_request',
      fromUid: challengeRequest.fromUid,
      toUid: challengeRequest.toUid,
      title: 'Room Ready',
      message: 'Friendly Duel room created. Enter the match when ready.',
      challengeRequestId: challengeRequest.id,
      read: false,
      createdAt: Date.now()
    };

    // Write both notifications
    await setDoc(doc(db, 'users', challengeRequest.fromUid, 'notifications', hostNotifId), hostNotif);
    await setDoc(doc(db, 'users', challengeRequest.toUid, 'notifications', guestNotifId), guestNotif);
    return true;
  } catch (err) {
    console.error('[notificationService] Failed to create room ready notifications:', err);
    return false;
  }
}
