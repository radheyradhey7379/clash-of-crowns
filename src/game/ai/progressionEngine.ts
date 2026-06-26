import { AIProgress, AIMatchResult, AITier } from '../../types/aiProgression';
import { AI_CHARACTERS } from './aiCharacters';

/**
 * Returns true if a character ID is unlocked for the user's progress.
 */
export function isCharacterUnlocked(characterId: string, progress: AIProgress): boolean {
  const char = AI_CHARACTERS.find(c => c.id === characterId);
  if (!char) return false;

  const TIER_ORDER: Record<string, number> = {
    'core': 1,
    'beginner': 2,
    'learner': 3,
    'promotion_trial': 4,
    'intermediate': 5,
    'hard': 6,
    'master': 7,
    'grandmaster': 8
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
      const targetLevel = (progress.masterCup.currentCup - 1) * 4 + progress.masterCup.currentMatch;
      return char.level <= targetLevel;
    }
    if (char.tier === 'grandmaster') {
      if (char.level === 1) return true;
      if (char.level === 2) return progress.grandmaster.bossDefeated;
    }
    return char.level <= progress.level;
  }

  // If the character's tier is higher than the player's current tier, it's locked.
  return false;
}

export interface GameResultCTA {
  label: "NEXT LEVEL" | "NEXT CHALLENGE" | "PLAY AGAIN" | "RETRY" | "REMATCH" | "BACK TO LEVELS";
  nextCharacterId: string | null;
}

export function getGameResultCTA(
  result: 'win' | 'loss' | 'draw',
  characterId: string | null,
  progress: AIProgress
): GameResultCTA {
  if (result === 'draw') {
    return { label: 'REMATCH', nextCharacterId: null };
  }

  if (result === 'loss') {
    return { label: 'PLAY AGAIN', nextCharacterId: null };
  }

  // result === 'win'
  if (!characterId) {
    return { label: 'PLAY AGAIN', nextCharacterId: null };
  }

  const idx = AI_CHARACTERS.findIndex(c => c.id === characterId);
  if (idx === -1 || idx === AI_CHARACTERS.length - 1) {
    return { label: 'BACK TO LEVELS', nextCharacterId: null };
  }

  const nextChar = AI_CHARACTERS[idx + 1];
  // If the next character is unlocked, it is the next challenge!
  if (isCharacterUnlocked(nextChar.id, progress)) {
    const char = AI_CHARACTERS.find(c => c.id === characterId);
    const isNewTier = char && nextChar.tier !== char.tier;
    return {
      label: isNewTier ? 'NEXT CHALLENGE' : 'NEXT LEVEL',
      nextCharacterId: nextChar.id
    };
  }

  return { label: 'BACK TO LEVELS', nextCharacterId: null };
}

/**
 * Returns true if a character ID is exactly the user's current level.
 */
export function isCharacterCurrent(characterId: string, progress: AIProgress): boolean {
  const char = AI_CHARACTERS.find(c => c.id === characterId);
  if (!char) return false;

  if (char.tier === 'master' && progress.tier === 'master') {
    return char.cup === progress.masterCup.currentCup && char.level === ((char.cup - 1) * 4 + progress.masterCup.currentMatch);
  }

  if (char.tier === 'grandmaster' && progress.tier === 'grandmaster') {
    // Current is Boss if undefeated, else there is no strictly "current" one as it's mode-based
    return char.level === 1 && !progress.grandmaster.bossDefeated;
  }

  return char.tier === progress.tier && char.level === progress.level;
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

  switch (next.tier) {
    case 'core': {
      if (won) {
        next.elo += 20;
        next.level += 1;
        if (next.level > 5) {
          next.tier = 'beginner';
          next.level = 1;
          if (!next.unlockedTiers.includes('beginner')) {
            next.unlockedTiers.push('beginner');
          }
        }
      }
      break;
    }

    case 'beginner': {
      if (won) {
        next.elo += 25;
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
        next.elo += 25;
        next.level += 1;
        next.consecutiveLosses = 0;
        if (next.level > 5) {
          next.tier = 'promotion_trial';
          next.level = 1;
          next.promotionTrial.unlocked = true;
          if (!next.unlockedTiers.includes('promotion_trial')) {
            next.unlockedTiers.push('promotion_trial');
          }
        }
      } else {
        next.elo = Math.max(0, next.elo - 5);
        next.consecutiveLosses += 1;
        if (next.consecutiveLosses >= 2) {
          next.level = Math.max(1, next.level - 1);
          next.consecutiveLosses = 0;
        }
      }
      break;
    }

    case 'promotion_trial': {
      if (won) {
        next.elo += 30;
        next.level += 1;
        next.consecutiveLosses = 0;
        if (next.level > 5) {
          next.tier = 'intermediate';
          next.level = 1;
          next.promotionTrial.completed = true;
          if (!next.unlockedTiers.includes('intermediate')) {
            next.unlockedTiers.push('intermediate');
          }
        }
      } else {
        // Lose -> retry same trial character (level stays same)
        next.elo = Math.max(0, next.elo - 0); // No ELO loss
        next.consecutiveLosses = 0;
      }
      break;
    }

    case 'intermediate': {
      if (won) {
        next.elo += 30;
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
        next.elo = Math.max(0, next.elo - 10);
        next.consecutiveLosses += 1;
        if (next.consecutiveLosses >= 2) {
          next.level = Math.max(1, next.level - 1);
          next.consecutiveLosses = 0;
        }
      }
      break;
    }

    case 'hard': {
      if (won) {
        next.elo += 35;
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
        next.elo = Math.max(0, next.elo - 20);
        if (next.level === 1) {
          // Hard Level 1 loss locks Hard tier
          next.hard.locked = true;
          next.tier = 'intermediate';
          next.level = 8; // Drop to Intermediate Level 8
        } else {
          next.level -= 1; // Drop one level
        }
      }
      break;
    }

    case 'master': {
      const cup = next.masterCup;
      if (won) {
        next.elo += 40;
        cup.winsInCup += 1;
      } else {
        next.elo = Math.max(0, next.elo - 15);
        cup.lossesInCup += 1;
      }

      cup.currentMatch += 1;

      if (cup.currentMatch > 4) {
        // Cup series complete!
        if (cup.winsInCup >= 3) {
          // Cup cleared!
          if (!cup.completedCups.includes(cup.currentCup)) {
            cup.completedCups.push(cup.currentCup);
          }

          if (cup.currentCup === 3) {
            // Completed Cup 3
            if (next.elo >= 2500) {
              next.tier = 'grandmaster';
              next.level = 1; // Grandmaster Boss
              next.grandmaster.unlocked = true;
              if (!next.unlockedTiers.includes('grandmaster')) {
                next.unlockedTiers.push('grandmaster');
              }
            } else {
              // Cup completed but ELO < 2500. Stay in Cup 3 to farm ELO.
              cup.currentMatch = 1;
              cup.winsInCup = 0;
              cup.lossesInCup = 0;
              next.level = 9; // Reset to Cup 3 Match 1
            }
          } else {
            // Move to next Cup
            cup.currentCup = (cup.currentCup + 1) as 1 | 2 | 3;
            cup.currentMatch = 1;
            cup.winsInCup = 0;
            cup.lossesInCup = 0;
            next.level = (cup.currentCup - 1) * 4 + 1;
          }
        } else {
          // Cup failed! Retry same Cup
          cup.currentMatch = 1;
          cup.winsInCup = 0;
          cup.lossesInCup = 0;
          next.level = (cup.currentCup - 1) * 4 + 1;
        }
      } else {
        // Cup not yet complete, advance match
        next.level = (cup.currentCup - 1) * 4 + cup.currentMatch;
      }
      break;
    }

    case 'grandmaster': {
      const gm = next.grandmaster;
      if (next.level === 1) {
        // Boss fight (Crownless King) - Best of 3
        if (won) {
          gm.bossSeriesWins += 1;
          next.elo += 50;
        } else {
          gm.bossSeriesLosses += 1;
          next.elo = Math.max(0, next.elo - 25);
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
          next.elo += 50;
          gm.seasonPoints += 10;
        } else {
          next.elo = Math.max(0, next.elo - 25);
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
    const targetLevel = (cup - 1) * 4 + match;
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
  return targetChar?.id || 'core_1';
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
