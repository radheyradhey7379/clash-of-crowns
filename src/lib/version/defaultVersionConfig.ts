import { VersionGateConfig } from './versionGateTypes';
import { getCurrentAppVersion } from './appVersion';

/**
 * Default fallback configuration used if:
 * 1. The remote config fails to fetch (network error, Firebase down)
 * 2. The remote config is missing or invalid
 * 
 * Rules for v1.0:
 * - forceUpdate is false so the app is not stuck in an infinite blocking screen offline.
 * - maintenanceMode is false so the app is not stuck.
 * - All competitive multiplayer features are disabled to protect integrity offline.
 * - Social features (like poke) can remain enabled (handled by featureAvailability resolver later).
 */
export const DEFAULT_VERSION_CONFIG: VersionGateConfig = {
  latestVersion: getCurrentAppVersion(),
  minimumSupportedVersion: "1.0.0",
  forceUpdate: false,
  updateType: "optional",
  maintenanceMode: false,
  message: "Failed to fetch latest version data. Offline mode active.",
  playStoreUrl: "market://details?id=com.clashofcrowns.game",
  disabledFeatures: [
    "ranked_arena", 
    "tournaments"
  ],
  multiplayerEnabled: true,
  rustRealtimeEnabled: true,
  rankedArenaEnabled: false,
  challengeMatchEnabled: true,
  tournamentsEnabled: false,
};
