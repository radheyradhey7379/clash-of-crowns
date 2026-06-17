/**
 * src/lib/config/featureFlags.ts
 * Centralized feature flags for v1.0 and future releases.
 */

// Helper to safely get boolean environment variables
const getBooleanEnv = (key: string, defaultValue: boolean): boolean => {
  if (typeof import.meta === 'undefined' || typeof import.meta.env === 'undefined') {
    return defaultValue;
  }
  const val = import.meta.env[key];
  if (val === 'true') return true;
  if (val === 'false') return false;
  return defaultValue;
};

export const isMultiplayerEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_MULTIPLAYER', false);
export const isRustRealtimeEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_RUST_REALTIME', false);
export const isRankedArenaEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_RANKED_ARENA', false);
export const isSocialPokeEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_SOCIAL_POKE', true);
export const isChallengeMatchEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_CHALLENGE_MATCH', false);
export const isTournamentsEnabled = (): boolean => getBooleanEnv('VITE_ENABLE_TOURNAMENTS', false);

export const getDisabledFeatureMessage = (feature: 'multiplayer' | 'ranked' | 'tournament' | 'challenge'): string => {
  switch (feature) {
    case 'multiplayer':
    case 'ranked':
    case 'tournament':
    case 'challenge':
      return 'Coming Soon: Realtime battles are being polished for a fair, secure, and lag-free experience.';
    default:
      return 'Coming Soon!';
  }
};
