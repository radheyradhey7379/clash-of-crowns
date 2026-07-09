import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { resetPlayerData } from '../../lib/store';

/**
 * Permanently deletes a user's account and progress data.
 * Handles both Guest players and Authenticated Firebase users.
 */
export async function deleteAccountData(uid: string): Promise<void> {
  // 1. If logged in, delete cloud data
  if (uid && !uid.startsWith('guest_')) {
    try {
      // Delete user profile
      await deleteDoc(doc(db, 'users', uid));
      
      // Delete active session lock
      await deleteDoc(doc(db, 'users', uid, 'session', 'current'));
      
      // Delete leaderboard entries
      await deleteDoc(doc(db, 'leaderboards', 'comp_kings', 'entries', uid));
      await deleteDoc(doc(db, 'leaderboards', 'arena_kings', 'entries', uid));
      
      console.log(`[Delete Account] Firestore data deleted for user: ${uid}`);
    } catch (err) {
      console.warn('[Delete Account] Firestore deletion failed:', err);
    }

    // 2. Delete Firebase Auth account if possible
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await currentUser.delete();
        console.log('[Delete Account] Auth user deleted successfully.');
      } catch (err) {
        console.warn('[Delete Account] Auth user delete failed, signing out instead:', err);
        await auth.signOut();
      }
    }
  } else {
    // Sign out from any active session
    if (auth.currentUser) {
      await auth.signOut();
    }
  }

  // 3. Clear local settings, progress, and cache
  resetPlayerData();
  console.log('[Delete Account] Local player data cleared.');
}
