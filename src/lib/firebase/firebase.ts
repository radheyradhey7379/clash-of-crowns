import { initializeApp, setLogLevel } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  memoryLocalCache,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  limit, 
  Timestamp, 
  getDocFromServer,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock_api_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock_auth_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock_app_id",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "mock_measurement_id",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "mock_db_id",
};

const isRealValue = (val: string | undefined): boolean => {
  if (!val) return false;
  const lower = val.toLowerCase();
  return (
    lower !== 'your_api_key' &&
    lower !== 'mock_api_key' &&
    lower !== 'your_project' &&
    lower !== 'mock_project_id' &&
    lower !== 'mock_auth_domain' &&
    lower !== 'mock_app_id' &&
    lower !== 'mock_storage_bucket' &&
    lower !== 'mock_messaging_sender_id' &&
    !lower.startsWith('your_') &&
    !lower.startsWith('mock_')
  );
};

export const isFirebaseConfigured = !!(
  isRealValue(import.meta.env.VITE_FIREBASE_API_KEY) &&
  isRealValue(import.meta.env.VITE_FIREBASE_PROJECT_ID) &&
  isRealValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) &&
  isRealValue(import.meta.env.VITE_FIREBASE_APP_ID)
);

// Check for missing required config without crashing completely
if (!isFirebaseConfigured) {
  console.error("❌ Firebase Initialization Error: Missing required environment variables. App will run in fallback/offline mode if possible.");
}

// Enable debug logging to diagnose connection issues ONLY in DEV
if (import.meta.env.DEV) {
  setLogLevel('debug');
}

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use initializeFirestore with memoryLocalCache and forceLongPolling to avoid periodic assertion failures in sandboxed iframes
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Validate Connection to Firestore
async function testConnection() {
  try {
    console.log("Testing Firestore connection to database:", firebaseConfig.firestoreDatabaseId);
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("❌ Firestore connection failed: The client is offline. Check network and Firebase config.");
    } else {
      console.warn("⚠️ Firestore connection test warning:", error);
    }
  }
}
testConnection();

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
// Re-export User type
export type { User };
export { onAuthStateChanged, signInWithPopup, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, Timestamp, getDocFromServer, doc, runTransaction, writeBatch };

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    isAnonymous: boolean | undefined;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Social functions
export async function searchUserByUid(uid: string) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  try {
    await addDoc(collection(db, 'friendRequests'), {
      from: fromUid,
      to: toUid,
      status: 'pending',
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
  }
}

export async function sendMessage(chatId: string, senderUid: string, text: string) {
  try {
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      sender: senderUid,
      text,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
  }
}
