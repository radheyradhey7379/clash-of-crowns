import { VersionGateConfig, DisabledFeatureKey } from '../version/versionGateTypes';
import { auth, isFirebaseConfigured } from '../firebase';
import { getCurrentAppVersion, isVersionBelow } from '../version/appVersion';
import { 
  isMultiplayerEnabled,
  isRustRealtimeEnabled,
  isRankedArenaEnabled,
  isSocialPokeEnabled,
  isChallengeMatchEnabled,
  isTournamentsEnabled,
  isOnlineBetaEnabled
} from './featureFlags';

let currentRemoteConfig: VersionGateConfig | null = null;
let startupTime = Date.now();
let closedBetaPassed = true; // Enabled for staging/live testing of multiplayer
let chessAuthorityPassed = true; // Server FEN authority is verified and passed
let resultAuthorityPassed = true; // Server rating signing authority is verified and passed

export type HealthStatus = 'healthy' | 'failed' | 'unknown';
let nodeHealthStatus: HealthStatus = 'unknown';
let rustHealthStatus: HealthStatus = 'unknown';

export function resetStartupTime() {
  startupTime = Date.now();
}

export function setRemoteVersionConfig(config: VersionGateConfig) {
  currentRemoteConfig = config;
}

export function setNodeHealth(status: HealthStatus) {
  nodeHealthStatus = status;
}

export function setRustHealth(status: HealthStatus) {
  rustHealthStatus = status;
}

export function setBackendHealthy(healthy: boolean) {
  // Backward compatibility for tests/older files
  setRustHealth(healthy ? 'healthy' : 'failed');
  setNodeHealth(healthy ? 'healthy' : 'failed');
}

export function setClosedBetaPassed(passed: boolean) {
  closedBetaPassed = passed;
}

export function getEffectiveNodeHealth(): HealthStatus {
  if (nodeHealthStatus === 'unknown' && Date.now() - startupTime > 30000) {
    return 'failed';
  }
  return nodeHealthStatus;
}

export function getEffectiveRustHealth(): HealthStatus {
  if (rustHealthStatus === 'unknown' && Date.now() - startupTime > 30000) {
    return 'failed';
  }
  return rustHealthStatus;
}

/**
 * Resolves feature availability by combining local environment flags, remote configuration,
 * backend health, and authority gates.
 */
export function isFeatureAvailable(featureKey: DisabledFeatureKey, config: VersionGateConfig | null = currentRemoteConfig): boolean {
  // Hard-code ranked_arena and tournaments to false in this stage
  if (featureKey === 'ranked_arena' || featureKey === 'tournaments') {
    return false;
  }

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

  if (config === null) {
    remoteAllowed = true;
  }

  if (!remoteAllowed) {
    return false;
  }

  // Check app version supported
  if (config) {
    const currentVersion = getCurrentAppVersion();
    if (config.forceUpdate || isVersionBelow(currentVersion, config.minimumSupportedVersion)) {
      return false;
    }
  }

  // 3. Backend Health gate
  const nodeH = getEffectiveNodeHealth();
  const rustH = getEffectiveRustHealth();
  if (nodeH === 'failed' || rustH === 'failed') {
    return false;
  }

  // 4. Auth requirement
  const isAuthRequired = isFirebaseConfigured;
  const isUserLoggedIn = auth?.currentUser != null;
  const isBeta = isOnlineBetaEnabled();
  if (isAuthRequired && !isUserLoggedIn && !isBeta) {
    return false;
  }

  // Chess authority & Result authority gates
  if (!chessAuthorityPassed || !resultAuthorityPassed) {
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
    return "Coming Soon / Locked";
  }
  
  if (config?.maintenanceMode) {
    return "Maintenance";
  }

  if (config) {
    const currentVersion = getCurrentAppVersion();
    if (config.forceUpdate || isVersionBelow(currentVersion, config.minimumSupportedVersion)) {
      return "Update required";
    }
  }

  if (!isMultiplayerEnabled() || !isRustRealtimeEnabled()) {
    return "Feature disabled for beta";
  }

  if (config?.disabledFeatures?.includes(featureKey) || 
      (featureKey === 'multiplayer' && config?.multiplayerEnabled === false)) {
    return "Feature disabled for beta";
  }

  const isAuthRequired = isFirebaseConfigured;
  const isUserLoggedIn = auth?.currentUser != null;
  const isBeta = isOnlineBetaEnabled();
  if (isAuthRequired && !isUserLoggedIn && !isBeta) {
    return "Login required";
  }

  const nodeH = getEffectiveNodeHealth();
  const rustH = getEffectiveRustHealth();
  const elapsed = Date.now() - startupTime;

  if (nodeH === 'failed' || rustH === 'failed') {
    return "Backend unavailable";
  }

  if (nodeH === 'unknown' || rustH === 'unknown') {
    if (elapsed > 10000) {
      return "Checking connection...";
    }
  }

  if (!isFeatureAvailable(featureKey, config)) {
    return "Backend unavailable";
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
    console.log(" - nodeHealthStatus:", nodeHealthStatus, "(effective:", getEffectiveNodeHealth(), ")");
    console.log(" - rustHealthStatus:", rustHealthStatus, "(effective:", getEffectiveRustHealth(), ")");
    console.log(" - elapsed startup time:", Date.now() - startupTime, "ms");
    console.log(" - auth.currentUser:", auth?.currentUser?.uid || "null");
    console.log(" - isFirebaseConfigured:", isFirebaseConfigured);
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
