import { PlayerData } from '../../types';

/**
 * Calculates the score for the Comp Kings leaderboard.
 * Formula: Comp ELO + completedMasterCups * 500 + (grandmasterDefeated ? 1000 : 0) + winStreak * 50 + compWins * 10 + badgesCount * 100
 */
export function calculateCompScore(playerData: PlayerData): number {
  if (!playerData.aiProgress) return 0;
  
  const compElo = playerData.aiProgress.elo || 0;
  const completedMasterCups = playerData.aiProgress.masterCup?.completedCups?.length || 0;
  const grandmasterDefeated = playerData.aiProgress.grandmaster?.bossDefeated ? 1000 : 0;
  const winStreak = playerData.streak || 0;
  const compWins = playerData.wins || 0;
  const badgesCount = playerData.badges?.length || 0;

  return compElo + (completedMasterCups * 500) + grandmasterDefeated + (winStreak * 50) + (compWins * 10) + (badgesCount * 100);
}

/**
 * Calculates the score for the Arena Kings leaderboard.
 * Formula: Arena Rating (1200 base) + arenaWins * 20 - arenaLosses * 10 + arenaDraws * 5 + arenaWinRate * 100 + arenaMatches * 2
 * All stats are computed from the player's multiplayerHistory.
 */
export function calculateArenaScore(playerData: PlayerData): number {
  const history = playerData.multiplayerHistory || [];
  const arenaMatches = history.length;
  const arenaWins = history.filter(h => h.result === 'win').length;
  const arenaLosses = history.filter(h => h.result === 'loss').length;
  const arenaDraws = history.filter(h => h.result === 'draw').length;
  
  const arenaWinRate = arenaMatches > 0 ? (arenaWins / arenaMatches) : 0; // between 0 and 1
  const winRatePercent = arenaWinRate * 100; // between 0 and 100

  // Arena Rating is dynamic
  const arenaRating = playerData.arenaRating ?? 1200;

  return arenaRating + (arenaWins * 20) - (arenaLosses * 10) + (arenaDraws * 5) + winRatePercent + (arenaMatches * 2);
}
