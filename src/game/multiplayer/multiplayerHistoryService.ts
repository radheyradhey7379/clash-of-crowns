import { PlayerData } from '../../types';
import { MultiplayerHistoryItem } from './multiplayerTypes';
import { savePlayerData } from '../../lib/store';
import { triggerDebouncedSync } from '../../lib/cloud/cloudSyncManager';
import { uploadArenaLeaderboardEntry } from '../leaderboard/arenaLeaderboardService';

export function addMultiplayerHistoryItem(playerData: PlayerData, item: MultiplayerHistoryItem): PlayerData {
  const history = playerData.multiplayerHistory ? [...playerData.multiplayerHistory] : [];
  
  // Prepend new item and cap at 100
  const updatedHistory = [item, ...history].slice(0, 100);

  const updatedPlayerData: PlayerData = {
    ...playerData,
    multiplayerHistory: updatedHistory,
  };

  // Save via protected save system
  savePlayerData(updatedPlayerData);

  // Upload arena leaderboard entry non-blockingly
  if (updatedPlayerData.uid) {
    uploadArenaLeaderboardEntry(updatedPlayerData.uid, updatedPlayerData).catch(err => {
      console.warn('[multiplayerHistoryService] Failed to upload arena leaderboard entry:', err);
    });
  }

  // Trigger cloud sync
  try {
    triggerDebouncedSync();
  } catch (err) {
    console.warn('[multiplayerHistoryService] Failed to trigger debounced sync:', err);
  }

  return updatedPlayerData;
}

export function getMultiplayerHistory(playerData: PlayerData): MultiplayerHistoryItem[] {
  return playerData.multiplayerHistory || [];
}
