import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PlayerData } from '../../types';
import { isOnline } from '../offline/networkStatus';
import { validatePlayerData } from '../../game/security/validatePlayerData';
import { getOrCreateDeviceId } from '../protectedSave';
import { CloudSaveData, CLOUD_SAVE_SCHEMA_VERSION, migrateCloudSaveIfNeeded } from './cloudSaveSchema';
import { detectSuspiciousSave } from '../../game/security/suspiciousSaveDetector';

export interface CloudSaveResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Gets the local save checksum and updatedAt timestamp directly from the protected localStorage.
 */
function getLocalSaveMeta(): { checksum: string; updatedAt: number } {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { checksum: '', updatedAt: 0 };
  }
  try {
    const primaryJson = localStorage.getItem('clash_player_data');
    if (primaryJson) {
      const parsed = JSON.parse(primaryJson);
      return {
        checksum: parsed.checksum || '',
        updatedAt: parsed.updatedAt || 0
      };
    }
  } catch (e) {
    console.warn('[CloudSave] Failed to parse local save metadata:', e);
  }
  return { checksum: '', updatedAt: 0 };
}

/**
 * Helper to check if Firebase is online and user is logged in.
 */
function isCloudAvailable(): boolean {
  return isOnline() && auth.currentUser !== null;
}

/**
 * Checks if a cloud save document exists for the specified user ID.
 */
export async function cloudSaveExists(uid: string): Promise<CloudSaveResult<boolean>> {
  if (!isCloudAvailable()) {
    return { success: false, error: 'cloud_unavailable' };
  }

  try {
    const docRef = doc(db, 'cloudSaves', uid);
    const docSnap = await getDoc(docRef);
    return { success: true, data: docSnap.exists() };
  } catch (err: any) {
    console.warn('[CloudSaveService] cloudSaveExists failed:', err);
    return { success: false, error: err.message || 'unknown_error' };
  }
}

/**
 * Retrieves the cloud save data from Firestore.
 * Performs schema migrations and validation.
 */
export async function getCloudSave(uid: string): Promise<CloudSaveResult<CloudSaveData | null>> {
  if (!isCloudAvailable()) {
    return { success: false, error: 'cloud_unavailable' };
  }

  try {
    const docRef = doc(db, 'cloudSaves', uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return { success: true, data: null };
    }

    const rawData = docSnap.data();
    const migratedData = migrateCloudSaveIfNeeded(rawData);
    
    // Correction 2: Validate cloud playerData and aiProgress consistency before restore
    if (!migratedData || !migratedData.playerData) {
      return { success: false, error: 'invalid_cloud_schema' };
    }

    const isCloudValid = validatePlayerData(migratedData.playerData);
    if (!isCloudValid) {
      console.warn('[CloudSaveService] Retrieved cloud save is invalid or corrupt. Rejecting restore.');
      return { success: false, error: 'invalid_cloud_save_content' };
    }

    return { success: true, data: migratedData };
  } catch (err: any) {
    console.warn('[CloudSaveService] getCloudSave failed:', err);
    return { success: false, error: err.message || 'unknown_error' };
  }
}

/**
 * Uploads a complete cloud save document to Firestore.
 * Validates player data before doing so.
 */
export async function uploadCloudSave(
  uid: string,
  playerData: PlayerData
): Promise<CloudSaveResult<void>> {
  if (!isCloudAvailable()) {
    return { success: false, error: 'cloud_unavailable' };
  }

  // Correction 2: Validate local data before upload
  const isLocalValid = validatePlayerData(playerData);
  if (!isLocalValid) {
    console.warn('[CloudSaveService] Local player data is invalid or corrupt. Blocking upload.');
    return { success: false, error: 'invalid_local_save_content' };
  }

  // Phase 32B Cloud Save Protection
  const detection = detectSuspiciousSave(playerData);
  if (detection.shouldBlockCloudUpload) {
    console.warn('[CloudSaveService] Suspicious save detected. Blocking cloud upload.');
    // We log a safe security event but return success=false quietly to the cloud flow
    return { success: false, error: 'suspicious_save_blocked' };
  }

  try {
    const docRef = doc(db, 'cloudSaves', uid);
    const localMeta = getLocalSaveMeta();

    const cloudSaveData: CloudSaveData = {
      uid,
      playerData,
      aiProgress: playerData.aiProgress,
      coins: playerData.coins || 0,
      xp: playerData.xp || 0,
      badges: playerData.badges || [],
      settings: {
        musicOn: playerData.musicOn,
        sfxOn: playerData.sfxOn,
        cameraSensitivity: playerData.cameraSensitivity,
        fontSize: playerData.fontSize,
        showHints: playerData.showHints,
        undoEnabled: playerData.undoEnabled,
        language: playerData.language,
        viewMode: playerData.viewMode,
        selectedPieceSet: playerData.selectedPieceSet,
        boardTheme: playerData.boardTheme,
        preferredSide: playerData.preferredSide,
        lowGraphics: playerData.lowGraphics
      },
      saveVersion: CLOUD_SAVE_SCHEMA_VERSION,
      updatedAt: localMeta.updatedAt || Date.now(),
      deviceId: playerData.deviceId || getOrCreateDeviceId(),
      localSaveHash: localMeta.checksum,
      lastSyncedAt: Date.now()
    };

    await setDoc(docRef, cloudSaveData);
    return { success: true };
  } catch (err: any) {
    console.warn('[CloudSaveService] uploadCloudSave failed:', err);
    return { success: false, error: err.message || 'unknown_error' };
  }
}

/**
 * Performs a partial update to the cloud save document on Firestore.
 */
export async function updateCloudSave(
  uid: string,
  partialData: Partial<CloudSaveData>
): Promise<CloudSaveResult<void>> {
  if (!isCloudAvailable()) {
    return { success: false, error: 'cloud_unavailable' };
  }

  try {
    const docRef = doc(db, 'cloudSaves', uid);
    await updateDoc(docRef, {
      ...partialData,
      lastSyncedAt: Date.now()
    });
    return { success: true };
  } catch (err: any) {
    console.warn('[CloudSaveService] updateCloudSave failed:', err);
    return { success: false, error: err.message || 'unknown_error' };
  }
}
