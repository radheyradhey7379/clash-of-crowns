import CryptoJS from 'crypto-js';
import { PlayerData, SecurityFlag } from '../types';
import { logSecurityEvent } from '../game/security/securityLog';
import { validateAndRepairPlayerData } from '../game/security/validatePlayerData';
import { migrateAIProgress } from './store';

export interface ProtectedSave {
  version: string;
  payload: string; // Serialized PlayerData JSON string
  updatedAt: number;
  deviceId: string;
  checksum: string;
}

/**
 * Retrieves or creates a stable client-side device ID.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'node_environment';
  }
  let deviceId = localStorage.getItem("clash_of_crowns_device_id");
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("clash_of_crowns_device_id", deviceId);
  }
  return deviceId;
}

/**
 * Computes a simple client-side SHA-256 checksum of save fields.
 */
export function computeChecksum(payloadStr: string, updatedAt: number, deviceId: string, version: string): string {
  const dataToHash = `${payloadStr}|${updatedAt}|${deviceId}|${version}`;
  return CryptoJS.SHA256(dataToHash).toString();
}

/**
 * Creates a protected save structure from PlayerData.
 */
export function createProtectedSave(playerData: PlayerData): ProtectedSave {
  const version = '1.0.0';
  const payload = JSON.stringify(playerData);
  const updatedAt = Date.now();
  const deviceId = getOrCreateDeviceId();
  const checksum = computeChecksum(payload, updatedAt, deviceId, version);

  return {
    version,
    payload,
    updatedAt,
    deviceId,
    checksum
  };
}

/**
 * Verifies the integrity of a protected save object.
 */
export function verifyProtectedSave(save: any): boolean {
  if (!save || typeof save !== 'object') return false;
  if (typeof save.payload !== 'string') return false;
  if (typeof save.updatedAt !== 'number') return false;
  if (typeof save.deviceId !== 'string') return false;
  if (typeof save.version !== 'string') return false;
  if (typeof save.checksum !== 'string') return false;

  const recomputed = computeChecksum(save.payload, save.updatedAt, save.deviceId, save.version);
  return recomputed === save.checksum;
}

/**
 * Loads protected PlayerData from localStorage.
 * Supports primary save, backup restore, legacy migration, device check, and safe fallbacks.
 */
export function loadProtectedPlayerData(defaultData: PlayerData): PlayerData {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return defaultData;
  }

  const currentDeviceId = getOrCreateDeviceId();
  const primaryJson = localStorage.getItem("clash_player_data");
  const backupJson = localStorage.getItem("clash_player_data_backup");
  const resetMarkerStr = localStorage.getItem("clash_reset_marker_at");
  const resetMarker = resetMarkerStr ? parseInt(resetMarkerStr, 10) : 0;

  let primaryParsed: any = null;
  let primaryValid = false;
  let primaryErrorType: 'checksum_mismatch' | 'invalid_save' | null = null;

  // 1. Attempt to load primary save
  if (primaryJson) {
    try {
      primaryParsed = JSON.parse(primaryJson);
      if (verifyProtectedSave(primaryParsed)) {
        if (primaryParsed.updatedAt >= resetMarker) {
          primaryValid = true;
        } else {
          console.warn("Primary save is older than reset marker. Ignoring.");
          primaryErrorType = 'checksum_mismatch';
        }
      } else {
        primaryErrorType = 'checksum_mismatch';
      }
    } catch (e) {
      primaryErrorType = 'invalid_save';
    }
  }

  if (primaryValid && primaryParsed) {
    try {
      let data = JSON.parse(primaryParsed.payload) as PlayerData;

      // Check device ID mismatch (log and update, do not lock out)
      if (primaryParsed.deviceId !== currentDeviceId) {
        data = logSecurityEvent(
          data,
          'device_change_detected',
          'medium',
          `Save imported from device ${primaryParsed.deviceId} to ${currentDeviceId}`
        );
        data.deviceId = currentDeviceId;
      }

      const { data: repairedData, repaired } = validateAndRepairPlayerData(data);
      if (repaired) {
        // Save the repaired data immediately
        saveProtectedPlayerData(repairedData);
      }
      return repairedData;
    } catch (e) {
      primaryValid = false;
      primaryErrorType = 'invalid_save';
    }
  }

  // 2. Fallback to backup if primary failed
  if (primaryJson && !primaryValid) {
    console.warn(`Primary save failed verification (${primaryErrorType}). Attempting backup restore...`);
    let backupParsed: any = null;
    let backupValid = false;

    if (backupJson) {
      try {
        backupParsed = JSON.parse(backupJson);
        if (verifyProtectedSave(backupParsed)) {
          if (backupParsed.updatedAt >= resetMarker) {
            backupValid = true;
          } else {
            console.warn("Backup save is older than reset marker. Ignoring.");
          }
        }
      } catch (e) {
        // backup parsing failed
      }
    }

    if (backupValid && backupParsed) {
      try {
        let data = JSON.parse(backupParsed.payload) as PlayerData;

        // Log device mismatch on backup if needed
        if (backupParsed.deviceId !== currentDeviceId) {
          data = logSecurityEvent(
            data,
            'device_change_detected',
            'medium',
            `Backup save imported from device ${backupParsed.deviceId}`
          );
          data.deviceId = currentDeviceId;
        }

        // Log the failure of the primary save into this restored data
        data = logSecurityEvent(
          data,
          primaryErrorType || 'invalid_save',
          'high',
          `Primary save failed validation. Restored state from backup.`
        );

        const { data: repairedData } = validateAndRepairPlayerData(data);
        saveProtectedPlayerData(repairedData);
        return repairedData;
      } catch (e) {
        // backup payload parsing failed
      }
    }

    // Both failed
    console.error("Both primary and backup saves are corrupt or invalid. Resetting to default.");
    let data = JSON.parse(JSON.stringify(defaultData)) as PlayerData;
    data = logSecurityEvent(
      data,
      primaryErrorType || 'invalid_save',
      'high',
      `Primary and backup saves were both invalid/corrupted. Reset to default player state.`
    );
    const { data: repairedData } = validateAndRepairPlayerData(data);
    saveProtectedPlayerData(repairedData);
    return repairedData;
  }

  // 3. Migration of old legacy plain text save if no new save exists
  if (!primaryJson) {
    const legacyJson = localStorage.getItem("clash_of_crowns_player_data");
    if (legacyJson) {
      try {
        const legacyData = JSON.parse(legacyJson);
        // Map any legacy formats if necessary
        legacyData.aiProgress = migrateAIProgress(legacyData);
        const merged = { ...defaultData, ...legacyData };
        let data = validateAndRepairPlayerData(merged).data;

        // Log legacy migration event
        data = logSecurityEvent(
          data,
          'legacy_save_migration',
          'low',
          'Migrated legacy plain-text save into protected save structure'
        );

        saveProtectedPlayerData(data);
        localStorage.removeItem("clash_of_crowns_player_data");
        return data;
      } catch (e) {
        // legacy parsing failed
      }
    }
  }

  // 4. If all else fails (e.g. fresh launch), return clean default data
  return defaultData;
}

/**
 * Saves PlayerData securely in primary and backup keys.
 */
export function saveProtectedPlayerData(playerData: PlayerData): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  // Ensure data is fully validated and repaired before saving
  const { data: cleanData } = validateAndRepairPlayerData(playerData);
  cleanData.deviceId = getOrCreateDeviceId();

  const protectedSave = createProtectedSave(cleanData);
  const saveJson = JSON.stringify(protectedSave);

  // Phase 32B Backup Policy: Backup previous primary before overwriting
  const previousPrimary = localStorage.getItem("clash_player_data");
  if (previousPrimary) {
    // Only backup if previous primary was not empty
    localStorage.setItem("clash_player_data_backup", previousPrimary);
  }

  localStorage.setItem("clash_player_data", saveJson);
}
