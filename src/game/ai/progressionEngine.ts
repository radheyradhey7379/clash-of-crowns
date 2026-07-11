import { AIProgress, AIMatchResult, AITier } from '../../types/aiProgression';
import { AI_CHARACTERS } from './aiCharacters';

/**
 * Returns true if a character ID is unlocked for the user's progress.
 */
export function isCharacterUnlocked(characterId: string, progress: AIProgress): boolean {
  const char = AI_CHARACTERS.find(c => c.id === characterId);
  if (!char) return false;

  const TIER_ORDER: Record<string, number> = {
    'beginner': 1,
    'learner': 2,
    'intermediate': 3,
    'hard': 4,
    'master': 5,
    'grandmaster': 6
  };

  const charTierVal = TIER_ORDER[char.tier] || 0;
  const progressTierVal = TIER_ORDER[progress.tier] || 0;

  // If the character's tier is lower than the player's current tier, it's completely unlocked.
  if (charTierVal < progressTierVal) {
    return true;
  }

  // If the character is in the current tier, we check if its level is less than or equal to the player's current level.
  if (charTierVal === progressTierVal) {
    if (char.tier === 'master') {
      const targetLevel = (progress.masterCup.currentCup - 1) * 3 + progress.masterCup.currentMatch;
      return char.level <= targetLevel;
    }
    if (char.tier === 'grandmaster') {
      if (char.level === 1) return true;
      return progress.grandmaster.bossDefeated;
    }
    return char.level <= progress.level;
  }

  // If the character's tier is higher than the player's current tier, it's locked.
  return false;
}

export interface GameResultCTA {
  label: "NEXT LEVEL" | "NEXT CHALLENGE" | "REPLAY" | "RETRY";
  nextCharacterId: string | null;
}

export function getGameResultCTA(
  result: 'win' | 'loss' | 'draw',
  characterId: string | null,
  progress: AIProgress
): GameResultCTA {
  if (result === 'draw') {
    return { label: 'RETRY', nextCharacterId: null };
  }

  if (result === 'loss') {
    return { label: 'RETRY', nextCharacterId: null };
  }

  // result === 'win'
  if (!characterId) {
    return { label: 'REPLAY', nextCharacterId: null };
  }

  const idx = AI_CHARACTERS.findIndex(c => c.id === characterId);
  if (idx === -1 || idx === AI_CHARACTERS.length - 1) {
    return { label: 'REPLAY', nextCharacterId: null };
  }

  const nextChar = AI_CHARACTERS[idx + 1];
  if (isCharacterUnlocked(nextChar.id, progress)) {
    return {
      label: 'NEXT LEVEL',
      nextCharacterId: nextChar.id
    };
  }

  return { label: 'REPLAY', nextCharacterId: null };
}

/**
 * Returns true if a character ID is exactly the user's current level.
 */
export function isCharacterCurrent(characterId: string, progress: AIProgress): boolean {
  const char = AI_CHARACTERS.find(c => c.id === characterId);
  if (!char) return false;

  if (char.tier === 'master' && progress.tier === 'master') {
    return char.cup === progress.masterCup.currentCup && char.level === ((char.cup - 1) * 3 + progress.masterCup.currentMatch);
  }

  if (char.tier === 'grandmaster' && progress.tier === 'grandmaster') {
    return char.level === 1 && !progress.grandmaster.bossDefeated;
  }

  return char.tier === progress.tier && char.level === progress.level;
}

export function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

export function getKFactorForTier(tier: AITier): number {
  if (tier === 'hard' || tier === 'master') return 24;
  if (tier === 'grandmaster') return 16;
  return 32;
}

export function updateElo(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): { delta: number; newRating: number } {
  const S = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const expected = expectedScore(playerRating, opponentRating);
  const newRating = playerRating + kFactor * (S - expected);
  const roundedNew = Math.max(0, Math.round(newRating));
  return {
    delta: roundedNew - playerRating,
    newRating: roundedNew,
  };
}

/**
 * Applies the match result to the player's career progress.
 */
export function applyAIMatchResult(progress: AIProgress, result: AIMatchResult): AIProgress {
  // Deep clone the progress state to keep it immutable
  const next = JSON.parse(JSON.stringify(progress)) as AIProgress;

  const isDraw = result.result === 'draw' || result.isDraw === true;
  const won = result.result === 'win' || result.playerWon === true;

  if (isDraw) {
    // Draw: retry same level, no ELO change
    return next;
  }

  // 1. Calculate and update player ELO using expectedScore formula
  const opponent = AI_CHARACTERS.find(c => c.id === result.characterId);
  const opponentRating = opponent ? opponent.eloTarget : 100;
  const outcome: 'win' | 'loss' | 'draw' = won ? 'win' : 'loss';
  
  const eloResult = updateElo(next.elo, opponentRating, outcome, getKFactorForTier(next.tier));
  next.elo = eloResult.newRating;

  // Progression guard: only progress or regress if playing a level in the current tier or higher,
  // and only if the level played is equal to or greater than the current career level.
  if (result.characterId) {
    const TIER_ORDER: Record<string, number> = {
      'beginner': 1,
      'learner': 2,
      'intermediate': 3,
      'hard': 4,
      'master': 5,
      'grandmaster': 6
    };

    const charTier = opponent?.tier || 'beginner';
    const charLevel = opponent?.level || 1;

    const charTierVal = TIER_ORDER[charTier] || 0;
    const progressTierVal = TIER_ORDER[next.tier] || 0;

    const isCurrentOrHigherLevel = charTierVal > progressTierVal || 
      (charTierVal === progressTierVal && charLevel >= next.level);

    if (!isCurrentOrHigherLevel) {
      // Replaying an already-cleared lower level: do not update progression level/tier or demote
      return next;
    }
  }

  // 2. Process Level and Tier progression
  switch (next.tier) {
    case 'beginner': {
      if (won) {
        next.level += 1;
        if (next.level > 5) {
          next.tier = 'learner';
          next.level = 1;
          if (!next.unlockedTiers.includes('learner')) {
            next.unlockedTiers.push('learner');
          }
        }
      }
      break;
    }

    case 'learner': {
      if (won) {
        next.level += 1;
        next.consecutiveLosses = 0;
        if (next.level > 5) {
          next.tier = 'intermediate';
          next.level = 1;
          if (!next.unlockedTiers.includes('intermediate')) {
            next.unlockedTiers.push('intermediate');
          }
        }
      } else {
        next.consecutiveLosses += 1;
        if (next.consecutiveLosses >= 3) {
          if (next.level === 1) {
            next.tier = 'beginner';
            next.level = 5;
          } else {
            next.level = Math.max(1, next.level - 1);
          }
          next.consecutiveLosses = 0;
        }
      }
      break;
    }

    case 'intermediate': {
      if (won) {
        next.level += 1;
        next.consecutiveLosses = 0;
        if (next.level > 8) {
          next.tier = 'hard';
          next.level = 1;
          next.hard.locked = false;
          if (!next.unlockedTiers.includes('hard')) {
            next.unlockedTiers.push('hard');
          }
        }
      } else {
        next.consecutiveLosses += 1;
        if (next.consecutiveLosses >= 2) {
          if (next.level === 1) {
            next.tier = 'learner';
            next.level = 5;
          } else {
            next.level = Math.max(1, next.level - 1);
          }
          next.consecutiveLosses = 0;
        }
      }
      break;
    }

    case 'hard': {
      if (won) {
        next.level += 1;
        if (next.level > 8) {
          next.tier = 'master';
          next.level = 1;
          next.masterCup.currentCup = 1;
          next.masterCup.currentMatch = 1;
          next.masterCup.winsInCup = 0;
          next.masterCup.lossesInCup = 0;
          if (!next.unlockedTiers.includes('master')) {
            next.unlockedTiers.push('master');
          }
        }
      } else {
        if (next.level === 1) {
          next.tier = 'intermediate';
          next.level = 8;
          next.hard.locked = true;
        } else {
          next.level -= 1;
        }
      }
      break;
    }

    case 'master': {
      const cup = next.masterCup;
      if (won) {
        cup.winsInCup += 1;
      } else {
        cup.lossesInCup += 1;
      }

      cup.currentMatch += 1;

      if (cup.currentMatch > 3) {
        // Cup series complete! Determine outcome based on round robin result (cupCleared)
        if (result.cupCleared) {
          // Cup cleared!
          if (!cup.completedCups.includes(cup.currentCup)) {
            cup.completedCups.push(cup.currentCup);
          }

          if (cup.currentCup === 3) {
            // Completed Cup 3
            if (next.elo >= 1450) {
              next.tier = 'grandmaster';
              next.level = 1; // Grandmaster Boss
              next.grandmaster.unlocked = true;
              if (!next.unlockedTiers.includes('grandmaster')) {
                next.unlockedTiers.push('grandmaster');
              }
            } else {
              // Cup completed but ELO < 1450. Stay in Cup 3 to farm ELO.
              cup.currentMatch = 1;
              cup.winsInCup = 0;
              cup.lossesInCup = 0;
              next.level = 7; // Reset to Cup 3 Match 1
            }
          } else {
            // Move to next Cup
            cup.currentCup = (cup.currentCup + 1) as 1 | 2 | 3;
            cup.currentMatch = 1;
            cup.winsInCup = 0;
            cup.lossesInCup = 0;
            next.level = (cup.currentCup - 1) * 3 + 1;
          }
        } else {
          // Cup failed! Retry same Cup
          cup.currentMatch = 1;
          cup.winsInCup = 0;
          cup.lossesInCup = 0;
          next.level = (cup.currentCup - 1) * 3 + 1;
        }
      } else {
        // Cup not yet complete, advance match
        next.level = (cup.currentCup - 1) * 3 + cup.currentMatch;
      }
      break;
    }

    case 'grandmaster': {
      const gm = next.grandmaster;
      if (next.level === 1) {
        // Boss fight (Crownless King) - Best of 3
        if (won) {
          gm.bossSeriesWins += 1;
        } else {
          gm.bossSeriesLosses += 1;
        }

        if (gm.bossSeriesWins === 2) {
          // Defeated Boss!
          gm.bossDefeated = true;
          gm.bossSeriesWins = 0;
          gm.bossSeriesLosses = 0;
        } else if (gm.bossSeriesLosses === 2) {
          // Failed Boss Fight! Reset series
          gm.bossSeriesWins = 0;
          gm.bossSeriesLosses = 0;
        }
      } else {
        // Daily challenge or seasonal prestige match
        if (won) {
          gm.seasonPoints += 10;
        }
      }
      break;
    }
  }

  return next;
}

/**
 * Returns the character ID of the current playable character based on career progress.
 */
export function getCurrentPlayableCharacterId(progress: AIProgress): string {
  const currentTier = progress.tier;
  if (currentTier === 'master') {
    const cup = progress.masterCup.currentCup;
    const match = progress.masterCup.currentMatch;
    const targetLevel = (cup - 1) * 3 + match;
    const targetChar = AI_CHARACTERS.find(c => c.tier === 'master' && c.level === targetLevel);
    return targetChar?.id || 'master_1_1';
  }

  if (currentTier === 'grandmaster') {
    if (!progress.grandmaster.bossDefeated) {
      return 'grandmaster_1'; // Crownless King (Boss)
    }
    return 'grandmaster_2'; // Daily Challenger
  }

  const targetChar = AI_CHARACTERS.find(c => c.tier === currentTier && c.level === progress.level);
  return targetChar?.id || 'beginner_1';
}

/**
 * Validates if the selected character can be played given the current progression state.
 */
export function validateCharacterSelection(
  characterId: string | null | undefined,
  progress: AIProgress
): { valid: boolean; reason?: string; fallbackCharacterId: string } {
  const fallbackId = getCurrentPlayableCharacterId(progress);
  if (!characterId) {
    return { valid: false, reason: 'Missing character ID', fallbackCharacterId: fallbackId };
  }

  const char = AI_CHARACTERS.find(c => c.id === characterId);
  if (!char) {
    return { valid: false, reason: 'Invalid character ID', fallbackCharacterId: fallbackId };
  }

  // Prevent locked characters from starting a match
  const unlocked = isCharacterUnlocked(characterId, progress);
  if (!unlocked) {
    return { valid: false, reason: 'Character is locked', fallbackCharacterId: fallbackId };
  }

  return { valid: true, fallbackCharacterId: fallbackId };
}
