import { PlayerData } from '../../types';
import { loadPlayerData, savePlayerData, DEFAULT_PLAYER_DATA } from '../store';

/**
 * Interface wrapper for accessing local player data storage.
 * Resolves data immediately using Phase 17's protected save system without Firebase.
 */
export const localPlayerStore = {
  /**
   * Loads the current player data from protected localStorage.
   */
  loadLocalData(): PlayerData {
    return loadPlayerData();
  },

  /**
   * Saves the player data locally with checksum protection.
   */
  saveLocalData(data: PlayerData): void {
    savePlayerData(data);
  },

  /**
   * Returns the default player data structure.
   */
  getDefaultData(): PlayerData {
    return DEFAULT_PLAYER_DATA;
  }
};
