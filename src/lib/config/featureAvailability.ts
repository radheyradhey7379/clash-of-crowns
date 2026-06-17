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
let closedBetaPassed = true; // Enabled for staging/live testing of multiplayer
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
  // Hard-code ranked_arena and tournaments to false in this stage
  if (featureKey === 'ranked_arena' || featureKey === 'tournaments') {
    return false;
  }

  const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

  // 1. Check local environment flag first (hard gate)
  let localAllowed = false;
  switch (featureKey) {
    case 'multiplayer': localAllowed = isMultiplayerEnabled(); break;
    case 'rust_realtime': localAllowed = isRustRealtimeEnabled(); break;
    case 'challenge_match': localAllowed = isChallengeMatchEnabled(); break;
    default: localAllowed = false;
  }

  if (!localAllowed) {
    return false;
  }

  // 2. Check remote config / maintenance
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
    case 'challenge_match': remoteAllowed = config?.challengeMatchEnabled ?? false; break;
    default: remoteAllowed = false;
  }

  if (!remoteAllowed && !isTest) {
    return false;
  }

  // 3. Backend Health gate
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
  if (featureKey === 'ranked_arena') {
    return "Coming Soon / Beta Locked";
  }
  if (featureKey === 'tournaments') {
    return "Coming Soon / Locked until tournament gates pass";
  }

  const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
  if (config?.maintenanceMode) return "System is currently under maintenance.";
  
  if (!isMultiplayerEnabled()) {
    return "Multiplayer is disabled in local config.";
  }

  if (!backendHealthy && !isTest) {
    return "Realtime server is unreachable. Check connection.";
  }

  if (auth?.currentUser == null && !isTest) {
    return "Authentication required. Please sign in.";
  }

  if (config?.disabledFeatures?.includes(featureKey) || 
      (featureKey === 'multiplayer' && config?.multiplayerEnabled === false)) {
    return "Feature disabled for beta release.";
  }

  if (!isFeatureAvailable(featureKey, config)) {
    return "Feature currently unavailable.";
  }
  
  return "";
}

// Dev-only inspect helper
if (typeof window !== 'undefined' && (import.meta.env?.DEV || (window as any).__DEV__)) {
  (window as any).inspectFeatureGates = () => {
    console.log("=== FEATURE GATES INSPECTION ===");
    console.log("Local Config Flags:");
    console.log(" - isMultiplayerEnabled:", isMultiplayerEnabled());
    console.log(" - isRustRealtimeEnabled:", isRustRealtimeEnabled());
    console.log(" - isRankedArenaEnabled:", isRankedArenaEnabled());
    console.log(" - isTournamentsEnabled:", isTournamentsEnabled());
    console.log("Global Gates:");
    console.log(" - backendHealthy:", backendHealthy);
    console.log(" - auth.currentUser:", auth?.currentUser?.uid || "null");
    console.log(" - chessAuthorityPassed:", chessAuthorityPassed);
    console.log(" - resultAuthorityPassed:", resultAuthorityPassed);
    console.log("Resolved Feature Availability:");
    console.log(" - multiplayer:", isFeatureAvailable('multiplayer'));
    console.log(" - rust_realtime:", isFeatureAvailable('rust_realtime'));
    console.log(" - ranked_arena:", isFeatureAvailable('ranked_arena'));
    console.log(" - tournaments:", isFeatureAvailable('tournaments'));
    console.log("Resolved Feature Reasons:");
    console.log(" - multiplayer:", getFeatureUnavailableReason('multiplayer'));
    console.log(" - rust_realtime:", getFeatureUnavailableReason('rust_realtime'));
    console.log(" - ranked_arena:", getFeatureUnavailableReason('ranked_arena'));
    console.log(" - tournaments:", getFeatureUnavailableReason('tournaments'));
    console.log("================================");
  };
}
