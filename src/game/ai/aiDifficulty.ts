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
  const blunderRate = (character as any).blunderRate !== undefined 
    ? (character as any).blunderRate 
    : Math.min(1, (character.errorNoiseCp || 0) / 1000);

  const skillLevel = Math.max(0, Math.min(20, Math.round(20 - (blunderRate * 20))));

  // Resolve maxThinkTimeMs based on character config or tier fallback
  let maxThinkTimeMs = character.maxThinkTimeMs;
  if (!maxThinkTimeMs) {
    switch (character.tier) {
      case 'beginner': maxThinkTimeMs = 500; break;
      case 'learner': maxThinkTimeMs = 700; break;
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
    blunderRate,
    skillLevel,
    maxThinkTimeMs,
    moveDelayMs
  };
}
