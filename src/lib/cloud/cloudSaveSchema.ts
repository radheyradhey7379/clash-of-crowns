import { PlayerData, AIProgress } from '../../types';

export const CLOUD_SAVE_SCHEMA_VERSION = '1.0.0';

export interface CloudSaveData {
  uid: string;
  playerData: PlayerData;
  aiProgress: AIProgress;
  coins: number;
  xp: number;
  badges: string[];
  settings: {
    musicOn: boolean;
    sfxOn: boolean;
    cameraSensitivity: number;
    fontSize: number;
    showHints: boolean;
    undoEnabled: boolean;
    language: string;
    viewMode: '2d' | '3d';
    selectedPieceSet: string;
    boardTheme: string;
    preferredSide: 'w' | 'b';
    lowGraphics?: boolean;
  };
  saveVersion: string;
  updatedAt: number;
  deviceId: string;
  localSaveHash: string; // checksum
  lastSyncedAt: number;
}

/**
 * Migration routine for cloud saves. Currently a no-op since 1.0.0 is the initial version,
 * but structured to allow future migrations.
 */
export function migrateCloudSaveIfNeeded(data: any): CloudSaveData {
  if (!data) return data;
  const version = data.saveVersion || '1.0.0';
  
  if (version !== CLOUD_SAVE_SCHEMA_VERSION) {
    console.log(`[CloudSave] Migrating cloud save from version ${version} to ${CLOUD_SAVE_SCHEMA_VERSION}`);
    // Future migrations can be placed here
  }
  
  return data as CloudSaveData;
}
