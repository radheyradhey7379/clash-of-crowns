import { PlayerData } from '../../types';

/**
 * Stamps a successful match completion to the player's metadata.
 */
export function stampMatchCompletion(playerData: PlayerData, matchId: string): PlayerData {
  const updated = { ...playerData };
  updated.lastMatchId = matchId;
  updated.totalMatchesCompleted = (updated.totalMatchesCompleted || 0) + 1;
  updated.lastRewardAt = Date.now();
  return updated;
}
