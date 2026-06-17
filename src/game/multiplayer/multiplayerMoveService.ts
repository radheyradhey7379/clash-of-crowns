import { db, doc, setDoc, collection, query, orderBy, onSnapshot, getDocs, limit } from '../../firebase';
import { MultiplayerMove } from './multiplayerTypes';

export async function submitMove(roomId: string, move: Omit<MultiplayerMove, 'moveId' | 'createdAt'>): Promise<void> {
  if (!roomId || !move.moveNumber) {
    throw new Error('Room ID and Move Number are required.');
  }

  const moveDocRef = doc(db, 'multiplayerRooms', roomId, 'moves', String(move.moveNumber));
  
  const moveData: MultiplayerMove = {
    moveId: String(move.moveNumber),
    roomId,
    moveNumber: move.moveNumber,
    from: move.from,
    to: move.to,
    promotion: move.promotion || '',
    color: move.color,
    playerUid: move.playerUid,
    fenAfter: move.fenAfter,
    san: move.san || '',
    createdAt: Date.now()
  };

  await setDoc(moveDocRef, moveData);
}

export function subscribeToMoves(roomId: string, callback: (moves: MultiplayerMove[]) => void): () => void {
  const movesCollectionRef = collection(db, 'multiplayerRooms', roomId, 'moves');
  const q = query(movesCollectionRef, orderBy('moveNumber', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const moves: MultiplayerMove[] = [];
    snapshot.forEach((doc) => {
      moves.push(doc.data() as MultiplayerMove);
    });
    callback(moves);
  }, (err) => {
    console.error("Error subscribing to moves:", err);
  });

  return unsubscribe;
}

export async function getLatestMove(roomId: string): Promise<MultiplayerMove | null> {
  const movesCollectionRef = collection(db, 'multiplayerRooms', roomId, 'moves');
  const q = query(movesCollectionRef, orderBy('moveNumber', 'desc'), limit(1));
  
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].data() as MultiplayerMove;
  }
  return null;
}
