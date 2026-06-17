import { AICharacter } from '../../types/aiProgression';

export interface AIDifficultySettings {
  depth: number;
  blunderRate: number;
  skillLevel: number;
  maxThinkTimeMs: number;
  moveDelayMs: number;
}

/**
 * Maps an AICharacter to its active difficulty configurations.
 */
export function getAIDifficultySettings(character: AICharacter): AIDifficultySettings {
  // Translate blunderRate (0 to 1) into Stockfish skill level (0 to 20)
  // Higher blunder rate = lower skill level.
  // skillLevel = 20 - (blunderRate * 20)
  const skillLevel = Math.max(0, Math.min(20, Math.round(20 - (character.blunderRate * 20))));

  // Resolve maxThinkTimeMs based on character config or tier fallback
  let maxThinkTimeMs = character.maxThinkTimeMs;
  if (!maxThinkTimeMs) {
    switch (character.tier) {
      case 'core': maxThinkTimeMs = 300; break;
      case 'beginner': maxThinkTimeMs = 500; break;
      case 'learner': maxThinkTimeMs = 700; break;
      case 'promotion_trial': maxThinkTimeMs = 900; break;
      case 'intermediate': maxThinkTimeMs = 1200; break;
      case 'hard': maxThinkTimeMs = 1600; break;
      case 'master': maxThinkTimeMs = 2200; break;
      case 'grandmaster': maxThinkTimeMs = 3000; break;
      default: maxThinkTimeMs = 1000;
    }
  }

  // Resolve moveDelayMs (human-like delay before playing a move)
  let moveDelayMs = character.moveDelayMs;
  if (!moveDelayMs) {
    // Standard is 50% of the think time, but at least 100ms
    moveDelayMs = Math.max(100, Math.round(maxThinkTimeMs * 0.5));
  }

  return {
    depth: character.depth,
    blunderRate: character.blunderRate,
    skillLevel,
    maxThinkTimeMs,
    moveDelayMs
  };
}
