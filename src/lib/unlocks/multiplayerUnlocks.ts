import { AI_CHARACTERS } from '../../game/ai/aiCharacters';
import { getCurrentPlayableCharacterId } from '../../game/ai/progressionEngine';
import { AIProgress } from '../../types/aiProgression';
import { auth, isFirebaseConfigured } from '../firebase';
import { 
  getEffectiveNodeHealth, 
  getEffectiveRustHealth,
  isFeatureAvailable
} from '../config/featureAvailability';
import { isOnlineBetaEnabled } from '../config/featureFlags';

export function getCareerLevel(progress: AIProgress | null | undefined): number {
  if (!progress) return 1;
  const currentCharId = getCurrentPlayableCharacterId(progress);
  const index = AI_CHARACTERS.findIndex(c => c.id === currentCharId);
  return index !== -1 ? index + 1 : 1;
}

export function canAccessCasualOnline(progress: AIProgress | null | undefined, entitlements: any): boolean {
  if (entitlements?.multiplayerPass === true) return true;
  const level = getCareerLevel(progress);
  if (level >= 5) return true;
  if (progress?.tier) {
    const unlockedTiers: string[] = ['learner', 'promotion_trial', 'intermediate', 'hard', 'master', 'grandmaster'];
    if (unlockedTiers.includes(progress.tier)) return true;
  }
  return false;
}

export function canAccessRanked(progress: AIProgress | null | undefined, entitlements: any): boolean {
  if (entitlements?.multiplayerPass === true) return true;
  const level = getCareerLevel(progress);
  if (level >= 15) return true;
  if (progress?.tier) {
    const unlockedTiers: string[] = ['intermediate', 'hard', 'master', 'grandmaster'];
    if (unlockedTiers.includes(progress.tier)) return true;
  }
  return false;
}

export function canAccessTournament(progress: AIProgress | null | undefined, entitlements: any): boolean {
  if (entitlements?.championshipPass === true) return true;
  const level = getCareerLevel(progress);
  if (level >= 20) return true;
  if (progress?.tier) {
    const unlockedTiers: string[] = ['hard', 'master', 'grandmaster'];
    if (unlockedTiers.includes(progress.tier)) return true;
  }
  return false;
}

export function getUnlockReason(
  mode: 'casual' | 'ranked' | 'tournament',
  progress: AIProgress | null | undefined,
  entitlements: any
): string {
  // Check backend gates first for Casual Match
  const nodeH = getEffectiveNodeHealth();
  const rustH = getEffectiveRustHealth();
  
  if (mode === 'casual') {
    // 1. Beta / version gate
    if (!isFeatureAvailable('multiplayer')) {
      return "Feature disabled for beta";
    }

    // 2. Health check
    if (nodeH === 'failed' || rustH === 'failed') {
      return "Backend unavailable. Retry.";
    }
    if (nodeH === 'unknown' || rustH === 'unknown') {
      return "Checking connection...";
    }

    // 3. Auth requirement
    const isAuthRequired = isFirebaseConfigured;
    const isUserLoggedIn = auth?.currentUser != null;
    const isBeta = isOnlineBetaEnabled();
    
    if (isAuthRequired && !isUserLoggedIn && !isBeta) {
      return "Login required for permanent online progress.";
    }

    // 4. Progress / Entitlement check
    if (!canAccessCasualOnline(progress, entitlements)) {
      return "Reach Level 5 in Comp Career to unlock Online Multiplayer.";
    }
  } else if (mode === 'ranked') {
    if (!canAccessRanked(progress, entitlements)) {
      return "Ranked Match unlocks after Level 15 or Premium + verification.";
    }
    return "Coming Soon";
  } else if (mode === 'tournament') {
    if (!canAccessTournament(progress, entitlements)) {
      return "Tournament unlocks after Level 20 or Championship Pass.";
    }
    return "Coming Soon";
  }

  return "";
}

export function getUnlockCTA(mode: 'casual' | 'ranked' | 'tournament'): string {
  switch (mode) {
    case 'casual':
      return "Play Comp Career";
    case 'ranked':
      return "Improve in Comp Career";
    case 'tournament':
      return "Play Comp Career";
    default:
      return "Play Comp Career";
  }
}
