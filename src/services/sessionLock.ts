import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getOrCreateDeviceId, clearSession } from '../lib/session';
import { signOut } from 'firebase/auth';

export const currentSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : Math.random().toString(36).substring(2) + Date.now().toString(36);

let isLockChecking = false;

/**
 * Initializes the active session on Firestore for this device.
 * Overwrites the active session ID, taking over the account session.
 */
export async function initializeSessionLock(uid: string): Promise<void> {
  if (!uid || uid.startsWith('guest_')) return;
  try {
    const deviceId = await getOrCreateDeviceId();
    const sessionRef = doc(db, 'users', uid, 'session', 'current');
    
    await setDoc(sessionRef, {
      activeSessionId: currentSessionId,
      deviceId,
      platform: typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform() ? 'capacitor' : 'web',
      updatedAt: serverTimestamp(),
      appVersion: '1.0.0'
    }, { merge: true });
    
    console.log(`[Session Lock] Session initialized for user ${uid}. Session ID: ${currentSessionId}`);
  } catch (err) {
    console.warn("[Session Lock] Failed to initialize session lock (running offline or network error):", err);
  }
}

/**
 * Periodically verifies that this device still holds the active session.
 * Returns true if session is valid, false if mismatched (taken over by another device).
 */
export async function verifySessionLock(uid: string): Promise<boolean> {
  if (!uid || uid.startsWith('guest_') || isLockChecking) return true;
  isLockChecking = true;
  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current');
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.activeSessionId && data.activeSessionId !== currentSessionId) {
        console.warn(`[Session Lock] Session mismatch detected! Active: ${data.activeSessionId}, Current: ${currentSessionId}`);
        return false;
      }
    }
  } catch (err) {
    console.warn("[Session Lock] Could not verify session lock (offline):", err);
  } finally {
    isLockChecking = false;
  }
  return true;
}

/**
 * Releases the active session from Firestore during manual logout.
 */
export async function releaseSessionLock(uid: string): Promise<void> {
  if (!uid || uid.startsWith('guest_')) return;
  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current');
    await updateDoc(sessionRef, {
      activeSessionId: '',
      updatedAt: serverTimestamp()
    });
    console.log(`[Session Lock] Session released for user ${uid}`);
  } catch (err) {
    console.warn("[Session Lock] Failed to release session lock:", err);
  }
}
