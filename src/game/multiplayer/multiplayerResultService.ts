import { db, doc, setDoc, onSnapshot } from '../../firebase';
import { getRoom, completeRoom } from './multiplayerRoomService';
import { MultiplayerResult, ResultType, ResultReason } from './multiplayerTypes';

export function validateResult(result: any): boolean {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const validStatuses: ResultType[] = ['completed', 'cancelled', 'abandoned'];
  const validReasons: ResultReason[] = ['checkmate', 'resign', 'timeout', 'draw', 'disconnect'];

  if (!validStatuses.includes(result.status)) {
    return false;
  }

  if (!validReasons.includes(result.reason)) {
    return false;
  }

  if (typeof result.endedAt !== 'number') {
    return false;
  }

  return true;
}

export async function submitResult(roomId: string, result: MultiplayerResult): Promise<void> {
  if (!roomId) {
    throw new Error('Room ID is required.');
  }

  if (!validateResult(result)) {
    throw new Error('Invalid multiplayer result format.');
  }

  // Idempotency check: retrieve room state
  const room = await getRoom(roomId);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.status === 'completed' || room.status === 'cancelled' || room.status === 'abandoned') {
    console.log(`[submitResult] Room ${roomId} is already in terminal state ${room.status}. Skipping submission.`);
    return;
  }

  // 1. Update the main room document (status + result field)
  await completeRoom(roomId, result);

  // 2. Also write to the subcollection document to satisfy rules structure
  const resultDocRef = doc(db, 'multiplayerRooms', roomId, 'results', 'matchResult');
  await setDoc(resultDocRef, result);
}

export function subscribeToResult(roomId: string, callback: (result: MultiplayerResult | null) => void): () => void {
  const resultDocRef = doc(db, 'multiplayerRooms', roomId, 'results', 'matchResult');

  const unsubscribe = onSnapshot(resultDocRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as MultiplayerResult);
    } else {
      callback(null);
    }
  }, (err) => {
    console.error("Error subscribing to result:", err);
  });

  return unsubscribe;
}
