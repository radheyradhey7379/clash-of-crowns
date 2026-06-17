import { db, doc, setDoc, updateDoc, collection, onSnapshot } from '../../firebase';
import { PlayerPresence } from './multiplayerTypes';

export async function setPlayerOnline(roomId: string, uid: string): Promise<void> {
  if (!roomId || !uid) return;
  const presenceDocRef = doc(db, 'multiplayerRooms', roomId, 'presence', uid);
  await setDoc(presenceDocRef, {
    uid,
    online: true,
    lastSeen: Date.now()
  });
}

export async function setPlayerOffline(roomId: string, uid: string): Promise<void> {
  if (!roomId || !uid) return;
  const presenceDocRef = doc(db, 'multiplayerRooms', roomId, 'presence', uid);
  await setDoc(presenceDocRef, {
    uid,
    online: false,
    lastSeen: Date.now()
  });
}

export async function updateLastSeen(roomId: string, uid: string): Promise<void> {
  if (!roomId || !uid) return;
  const presenceDocRef = doc(db, 'multiplayerRooms', roomId, 'presence', uid);
  await updateDoc(presenceDocRef, {
    lastSeen: Date.now()
  }).catch(async () => {
    // If doc doesn't exist, create it as online
    await setDoc(presenceDocRef, {
      uid,
      online: true,
      lastSeen: Date.now()
    });
  });
}

export function subscribeToPresence(roomId: string, callback: (presenceList: PlayerPresence[]) => void): () => void {
  const presenceCollectionRef = collection(db, 'multiplayerRooms', roomId, 'presence');

  const unsubscribe = onSnapshot(presenceCollectionRef, (snapshot) => {
    const list: PlayerPresence[] = [];
    snapshot.forEach((doc) => {
      list.push(doc.data() as PlayerPresence);
    });
    callback(list);
  }, (err) => {
    console.error("Error subscribing to presence:", err);
  });

  return unsubscribe;
}
