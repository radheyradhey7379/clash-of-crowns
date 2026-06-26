import { AICharacter, AITier } from '../../../types/aiProgression';
import { resolveEngine } from './botProfiles';
import { EngineType } from '../types';

export function validateEngineForTier(tier: AITier, requestedEngine: EngineType): boolean {
  const expectedEngine = resolveEngine(tier);
  // stockfish_benchmark is allowed on any tier for testing/benchmark if explicitly set,
  // but normally it should match expectedEngine.
  if (requestedEngine === 'stockfish_benchmark') return true;
  
  return requestedEngine === expectedEngine;
}

export function getEngineForCharacter(character: AICharacter): EngineType {
  const expected = resolveEngine(character.tier);
  
  if (character.engine !== expected && character.engine !== 'stockfish_benchmark') {
    console.warn(`Warning: Character ${character.id} specifies engine ${character.engine} but tier ${character.tier} expects ${expected}. Forcing ${expected}.`);
    return expected;
  }
  
  return character.engine;
}
