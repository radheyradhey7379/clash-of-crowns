import { AIProgress } from '../../../types/aiProgression';
import { CupRoundRobinState } from './cupRoundRobin';
import { EngineType } from '../types';

export interface CampaignSession {
  activeCharacterId: string;
  engineType: EngineType;
  cupState: CupRoundRobinState | null;
  matchStartTimestamp: number;
}

export function createCampaignSession(
  characterId: string, 
  engineType: EngineType,
  cupState: CupRoundRobinState | null = null
): CampaignSession {
  return {
    activeCharacterId: characterId,
    engineType,
    cupState,
    matchStartTimestamp: Date.now()
  };
}

export function isInCupMatch(session: CampaignSession): boolean {
  return session.cupState !== null && session.cupState.status === 'in_progress';
}
