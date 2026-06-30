import { PlayerData } from '../../types';
import { AIMatchResult, AIProgress } from '../../types/aiProgression';
import { AI_CHARACTERS } from './aiCharacters';
import { 
  applyAIMatchResult, 
  validateCharacterSelection, 
  getCurrentPlayableCharacterId 
} from './progressionEngine';
import { calculateAIMatchRewards, RewardResult } from './aiRewards';
import { validateMatchCompletion, markMatchCompleted } from '../security/matchSessionGuard';
import { logSecurityEvent } from '../security/securityLog';
import { savePlayerData } from '../../lib/store';
import { validateAndRepairPlayerData } from '../security/validatePlayerData';
import { stampMatchCompletion } from '../security/saveIntegrity';
import { uploadCompLeaderboardEntry } from '../leaderboard/compLeaderboardService';

export interface MatchResultSummary {
  updatedPlayerData: PlayerData;
  rewards: RewardResult;
  eloChange: number;
}

export const matchFlowService = {
  /**
   * Validates if a character can be challenged.
   * Returns a fallback character ID if invalid.
   */
  validateCharacter(
    characterId: string | null | undefined,
    progress: AIProgress
  ): { valid: boolean; reason?: string; fallbackCharacterId: string } {
    return validateCharacterSelection(characterId, progress);
  },

  /**
   * Fallback retrieval helper.
   */
  getFallbackCharacter(progress: AIProgress): string {
    return getCurrentPlayableCharacterId(progress);
  },

  /**
   * Compiles the match results, calculates progression updates, awards coins/XP,
   * adds unique badges, performs anti-cheat validations, saves player data,
   * and marks the match completed.
   */
  processMatchResult(
    matchResult: {
      matchId: string;
      characterId: string;
      result: 'win' | 'loss' | 'draw';
      reason: 'checkmate' | 'resign' | 'timeout' | 'draw';
      eloBefore: number;
    },
    playerData: PlayerData
  ): MatchResultSummary {
    // 1. Validate Match Session and Anti-Cheat checks
    const validation = validateMatchCompletion(
      matchResult.matchId,
      matchResult.characterId,
      matchResult.result,
      playerData
    );

    if (!validation.valid) {
      // Create high-severity flag based on failure reason
      let flagType = 'invalid_match_result';
      let message = 'Match completion failed session validation.';

      if (validation.reason === 'duplicate_match_result') {
        flagType = 'duplicate_match_result';
        message = `Attempted duplicate match completion for ID: ${matchResult.matchId}`;
      } else if (validation.reason === 'locked_character_attempt') {
        flagType = 'locked_character_attempt';
        message = `Attempted match completion against locked character: ${matchResult.characterId}`;
      } else if (validation.reason === 'too_fast_match') {
        flagType = 'too_fast_match';
        message = `Match completed suspiciously fast (duration: ${validation.duration}ms). Rewards blocked.`;
      } else if (validation.reason === 'invalid_session') {
        flagType = 'invalid_session';
        message = `Invalid or missing session for match: ${matchResult.matchId}`;
      }

      const flaggedData = logSecurityEvent(playerData, flagType, 'high', message);
      savePlayerData(flaggedData);

      return {
        updatedPlayerData: flaggedData,
        rewards: { coins: 0, xp: 0, newlyClaimedTierRewards: [], newlyClaimedCupRewards: [] },
        eloChange: 0
      };
    }

    // Append suspicious warning flag if too-fast but allowed (under 5s but >= 2s)
    let currentPlayerData = playerData;
    if (validation.reason === 'too_fast_suspicious') {
      currentPlayerData = logSecurityEvent(
        playerData,
        'too_fast_suspicious',
        'medium',
        `Match completed fast (duration: ${validation.duration}ms). Allowed but flagged.`
      );
    }

    const character = AI_CHARACTERS.find(c => c.id === matchResult.characterId);
    const tier = character?.tier || 'beginner';

    // 2. Build the expanded AIMatchResult
    const resultRecord: AIMatchResult = {
      characterId: matchResult.characterId,
      tier,
      result: matchResult.result,
      reason: matchResult.reason,
      eloBefore: matchResult.eloBefore,
      timestamp: Date.now(),
      playerWon: matchResult.result === 'win',
      isDraw: matchResult.result === 'draw',
      cupCleared: (matchResult as any).cupCleared
    };

    const oldProgress = currentPlayerData.aiProgress;

    // 3. Calculate progression updates
    const newProgress = applyAIMatchResult(oldProgress, resultRecord);

    // 4. Calculate rewards
    const rewards = calculateAIMatchRewards(matchResult.result, oldProgress, newProgress);

    // Merge newly claimed rewards into newProgress so they aren't awarded again
    if (rewards.newlyClaimedTierRewards.length > 0) {
      newProgress.claimedTierRewards = [...(newProgress.claimedTierRewards || []), ...rewards.newlyClaimedTierRewards];
    }
    if (rewards.newlyClaimedCupRewards.length > 0) {
      newProgress.claimedCupRewards = [...(newProgress.claimedCupRewards || []), ...rewards.newlyClaimedCupRewards];
    }

    // 5. Update badges uniquely
    const updatedBadges = [...(currentPlayerData.badges || [])];
    if (rewards.badge && !updatedBadges.includes(rewards.badge)) {
      updatedBadges.push(rewards.badge);
    }

    // 6. Update overall stats
    const wins = matchResult.result === 'win' ? (currentPlayerData.wins || 0) + 1 : (currentPlayerData.wins || 0);
    const losses = matchResult.result === 'loss' ? (currentPlayerData.losses || 0) + 1 : (currentPlayerData.losses || 0);
    const draws = matchResult.result === 'draw' ? (currentPlayerData.draws || 0) + 1 : (currentPlayerData.draws || 0);

    const totalGames = (currentPlayerData.totalGames || 0) + 1;
    const totalWins = wins;
    const totalLosses = losses;
    const totalDraws = draws;

    // Streaks
    let streak = currentPlayerData.streak || 0;
    if (matchResult.result === 'win') {
      streak += 1;
    } else if (matchResult.result === 'loss') {
      streak = 0;
    }
    const bestStreak = Math.max(streak, currentPlayerData.bestStreak || 0);

    // Color/Side specific stats
    const side = (matchResult as any).playerColor || 'w';
    let whiteGames = currentPlayerData.whiteGames || 0;
    let whiteWins = currentPlayerData.whiteWins || 0;
    let whiteLosses = currentPlayerData.whiteLosses || 0;
    let whiteDraws = currentPlayerData.whiteDraws || 0;

    let blackGames = currentPlayerData.blackGames || 0;
    let blackWins = currentPlayerData.blackWins || 0;
    let blackLosses = currentPlayerData.blackLosses || 0;
    let blackDraws = currentPlayerData.blackDraws || 0;

    if (side === 'w') {
      whiteGames += 1;
      if (matchResult.result === 'win') whiteWins += 1;
      else if (matchResult.result === 'loss') whiteLosses += 1;
      else if (matchResult.result === 'draw') whiteDraws += 1;
    } else {
      blackGames += 1;
      if (matchResult.result === 'win') blackWins += 1;
      else if (matchResult.result === 'loss') blackLosses += 1;
      else if (matchResult.result === 'draw') blackDraws += 1;
    }

    const eloChange = newProgress.elo - oldProgress.elo;

    // 7. Anti-Cheat: Validate impossible ELO, Coin, or XP jumps
    let verifiedRewards = { ...rewards };
    let verifiedEloChange = eloChange;
    const finalProgress = { ...newProgress };
    let finalPlayerData = currentPlayerData;

    if (verifiedEloChange > 50) {
      verifiedEloChange = 50;
      finalProgress.elo = oldProgress.elo + 50;
      finalPlayerData = logSecurityEvent(
        finalPlayerData,
        'impossible_elo_jump',
        'high',
        `Impossible ELO jump detected (${eloChange} ELO). Clipped to +50.`
      );
    }

    if (verifiedRewards.coins > 750) {
      verifiedRewards.coins = 750;
      finalPlayerData = logSecurityEvent(
        finalPlayerData,
        'impossible_coin_jump',
        'high',
        `Impossible coin jump detected (${rewards.coins} coins). Clipped to +750.`
      );
    }

    if (verifiedRewards.xp > 150) {
      verifiedRewards.xp = 150;
      finalPlayerData = logSecurityEvent(
        finalPlayerData,
        'impossible_xp_jump',
        'high',
        `Impossible XP jump detected (${rewards.xp} XP). Clipped to +150.`
      );
    }

    // Construct final player data object
    let updatedPlayerData: PlayerData = {
      ...finalPlayerData,
      wins,
      losses,
      draws,
      totalGames,
      totalWins,
      totalLosses,
      totalDraws,
      whiteGames,
      whiteWins,
      whiteLosses,
      whiteDraws,
      blackGames,
      blackWins,
      blackLosses,
      blackDraws,
      streak,
      bestStreak,
      currentStreak: streak,
      aiProgress: finalProgress,
      rating: finalProgress.elo, // Sync overall rating with career progression ELO
      coins: (finalPlayerData.coins || 0) + verifiedRewards.coins,
      xp: (finalPlayerData.xp || 0) + verifiedRewards.xp,
      badges: updatedBadges
    };

    // 8. Stamp metadata
    updatedPlayerData = stampMatchCompletion(updatedPlayerData, matchResult.matchId);

    // 9. Validate final PlayerData consistency & bounds before saving
    const repairResult = validateAndRepairPlayerData(updatedPlayerData);
    updatedPlayerData = repairResult.data;

    // 10. Save protected player data first (order constraint)
    savePlayerData(updatedPlayerData);

    // Upload comp leaderboard entry non-blockingly
    if (updatedPlayerData.uid) {
      uploadCompLeaderboardEntry(updatedPlayerData.uid, updatedPlayerData).catch(err => {
        console.warn('[matchFlowService] Failed to upload comp leaderboard entry:', err);
      });
    }

    // 10. Mark match completed only AFTER successful save
    markMatchCompleted(matchResult.matchId);

    return {
      updatedPlayerData,
      rewards: verifiedRewards,
      eloChange: verifiedEloChange
    };
  }
};
