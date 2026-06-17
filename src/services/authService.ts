import { auth, db, handleFirestoreError } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PlayerData } from '../types';
import { DEFAULT_PLAYER_DATA } from '../lib/store';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export async function syncUserProgress(user: any, localData: PlayerData): Promise<PlayerData> {
  if (!user) return localData;

  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const serverData = userDoc.data() as PlayerData;
      // Merge logic: prefer server data for critical stats (rating, wins, losses)
      // but keep local settings (music, sfx, etc.) if they are newer?
      // For now, let's just use server data as source of truth for stats.
      return {
        ...localData,
        ...serverData,
        uid: user.uid,
        name: user.displayName || serverData.name || localData.name,
        photoURL: user.photoURL || serverData.photoURL || ""
      };
    } else {
      // Create new user profile
      const newData = {
        ...localData,
        uid: user.uid,
        name: user.displayName || localData.name,
        email: user.email,
        photoURL: user.photoURL || "",
        createdAt: serverTimestamp(),
        rating: 300, // Initial rating
        wins: 0,
        losses: 0,
        draws: 0,
        isPremium: false
      };
      await setDoc(userRef, newData);
      return newData as PlayerData;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    return localData;
  }
}

export async function updateUserStats(uid: string, stats: Partial<PlayerData>) {
  const userRef = doc(db, 'users', uid);
  try {
    // Reverted security patch: allow updating all fields from client
    await updateDoc(userRef, stats);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}
