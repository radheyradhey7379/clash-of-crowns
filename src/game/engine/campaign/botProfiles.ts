import { AICharacter, AITier } from '../../../types/aiProgression';
import { EngineType, EngineStyle } from '../types';

export interface BotProfile {
  characterId: string;
  engineType: EngineType;
  depth: number;
  errorNoiseCp: number;
  maxThinkTimeMs: number;
  moveDelayMs: number;
  style: EngineStyle;
}

export function resolveEngine(tier: AITier): EngineType {
  switch (tier) {
    case 'beginner':
    case 'learner':
      return 'hce';
    case 'intermediate':
    case 'hard':
    case 'master':
    case 'grandmaster':
      return 'nnue';
    default:
      return 'hce';
  }
}

export function resolveErrorNoiseCp(tier: AITier, level: number): number {
  switch (tier) {
    case 'beginner':
      return 160;
    case 'learner':
      return 100;
    case 'intermediate':
      return Math.max(60, 120 - (level * 8));
    case 'hard':
      return Math.max(40, 60 - (level * 3));
    case 'master':
      return Math.max(10, 20 - (level * 2));
    case 'grandmaster':
      return 0;
    default:
      return 100;
  }
}

export function getBotProfile(character: AICharacter): BotProfile {
  return {
    characterId: character.id,
    engineType: character.engine,
    depth: character.depth,
    errorNoiseCp: character.errorNoiseCp,
    maxThinkTimeMs: character.maxThinkTimeMs || 2000,
    moveDelayMs: character.moveDelayMs || 500,
    style: {
      aggression: character.aggression,
      defense: character.defense,
      openingKnowledge: character.openingKnowledge,
      endgameSkill: character.endgameSkill
    }
  };
}
