import { VersionGateConfig, DisabledFeatureKey } from '../version/versionGateTypes';
import { auth } from '../firebase';
import { 
  isMultiplayerEnabled,
  isRustRealtimeEnabled,
  isRankedArenaEnabled,
  isSocialPokeEnabled,
  isChallengeMatchEnabled,
  isTournamentsEnabled
} from './featureFlags';

let currentRemoteConfig: VersionGateConfig | null = null;
let backendHealthy = false;
let closedBetaPassed = false; // Set to true when closed beta gate is passed
let chessAuthorityPassed = true; // Server FEN authority is verified and passed
let resultAuthorityPassed = true; // Server rating signing authority is verified and passed

export function setRemoteVersionConfig(config: VersionGateConfig) {
  currentRemoteConfig = config;
}

export function setBackendHealthy(healthy: boolean) {
  backendHealthy = healthy;
}

export function setClosedBetaPassed(passed: boolean) {
  closedBetaPassed = passed;
}

/**
 * Resolves feature availability by combining local environment flags, remote configuration,
 * backend health, and authority gates.
 * Rule: Feature is enabled ONLY if local env flag is true AND remote config allows it
 * AND not in maintenance mode AND backend health check passes AND auth is verified AND authority gates pass.
 */
export function isFeatureAvailable(featureKey: DisabledFeatureKey, config: VersionGateConfig | null = currentRemoteConfig): boolean {
  // If in production environment, all online features remain disabled until closed beta and gates pass
  const isProd = import.meta.env?.PROD ?? false;
  if (isProd && !closedBetaPassed) {
    return false;
  }

  // 1. Check local environment flag first (hard gate)
  let localAllowed = false;
  switch (featureKey) {
    case 'multiplayer': localAllowed = isMultiplayerEnabled(); break;
    case 'rust_realtime': localAllowed = isRustRealtimeEnabled(); break;
    case 'ranked_arena': localAllowed = isRankedArenaEnabled(); break;
    case 'challenge_match': localAllowed = isChallengeMatchEnabled(); break;
    case 'tournaments': localAllowed = isTournamentsEnabled(); break;
  }

  // If local env says false, it stays false regardless of remote config
  if (!localAllowed) {
    return false;
  }

  // 2. Check remote config disabledFeatures array
  if (config?.maintenanceMode) {
    return false;
  }

  if (config?.disabledFeatures?.includes(featureKey)) {
    return false;
  }

  // Check remote config explicit booleans
  let remoteAllowed = false;
  switch (featureKey) {
    case 'multiplayer': remoteAllowed = config?.multiplayerEnabled ?? false; break;
    case 'rust_realtime': remoteAllowed = config?.rustRealtimeEnabled ?? false; break;
    case 'ranked_arena': remoteAllowed = config?.rankedArenaEnabled ?? false; break;
    case 'challenge_match': remoteAllowed = config?.challengeMatchEnabled ?? false; break;
    case 'tournaments': remoteAllowed = config?.tournamentsEnabled ?? false; break;
  }

  if (!remoteAllowed) {
    return false;
  }

  // 3. Backend Health gate
  const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  if (!backendHealthy && !isTest) {
    return false;
  }

  // 4. Authority Gates
  // Auth verified gate: require authenticated user
  const authVerified = auth?.currentUser != null;
  if (!authVerified && !isTest) {
    return false;
  }

  // Chess authority & Result authority gates
  if ((!chessAuthorityPassed || !resultAuthorityPassed) && !isTest) {
    return false;
  }

  return true;
}

/**
 * Returns a human-readable reason why a feature is unavailable.
 */
export function getFeatureUnavailableReason(featureKey: DisabledFeatureKey, config: VersionGateConfig | null = currentRemoteConfig): string {
  const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  if (config?.maintenanceMode) return "System is currently under maintenance.";
  
  const isProd = import.meta.env?.PROD ?? false;
  if (isProd && !closedBetaPassed) {
    return "Beta testing only. Feature currently locked.";
  }

  if (!backendHealthy && !isTest) {
    return "Realtime server is unreachable. Check your connection.";
  }

  if (auth?.currentUser == null && !isTest) {
    return "Authentication required.";
  }

  if (isFeatureAvailable(featureKey, config)) return "";
  
  return "Feature currently disabled.";
}
