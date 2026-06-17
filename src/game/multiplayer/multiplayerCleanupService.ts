import { db, doc, updateDoc, collection, query, where, getDocs } from '../../firebase';
import { MultiplayerRoom } from './multiplayerTypes';

const activeSubscriptions: { [roomId: string]: (() => void)[] } = {};

export function registerSubscription(roomId: string, unsub: () => void): void {
  if (!activeSubscriptions[roomId]) {
    activeSubscriptions[roomId] = [];
  }
  activeSubscriptions[roomId].push(unsub);
}

export function stopRoomSubscriptions(roomId: string): void {
  if (activeSubscriptions[roomId]) {
    console.log(`[multiplayerCleanupService] Stopping all subscriptions for room: ${roomId}`);
    activeSubscriptions[roomId].forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.error('Error unsubscribing listener:', e);
      }
    });
    delete activeSubscriptions[roomId];
  }
}

export function cleanupRoomListeners(roomId: string): void {
  stopRoomSubscriptions(roomId);
}

export async function cleanupStaleWaitingRooms(): Promise<void> {
  try {
    const roomsCol = collection(db, 'multiplayerRooms');
    const q = query(roomsCol, where('status', '==', 'waiting'));
    const snap = await getDocs(q);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    for (const docSnap of snap.docs) {
      const room = docSnap.data() as MultiplayerRoom;
      if (now - room.createdAt > tenMinutes) {
        const roomDocRef = doc(db, 'multiplayerRooms', room.roomId);
        await updateDoc(roomDocRef, {
          status: 'cancelled',
          updatedAt: now,
        });
        console.log(`[cleanupStaleWaitingRooms] Cancelled stale room ${room.roomId}`);
      }
    }
  } catch (err) {
    console.error('Failed to cleanup stale waiting rooms:', err);
  }
}

export async function markRoomStaleIfExpired(room: MultiplayerRoom): Promise<boolean> {
  const tenMinutes = 10 * 60 * 1000;
  if ((room.status === 'waiting' || room.status === 'ready') && Date.now() - room.createdAt > tenMinutes) {
    try {
      const roomDocRef = doc(db, 'multiplayerRooms', room.roomId);
      await updateDoc(roomDocRef, {
        status: 'cancelled',
        updatedAt: Date.now(),
      });
      return true;
    } catch (err) {
      console.error(`Failed to mark room ${room.roomId} stale:`, err);
    }
  }
  return false;
}
