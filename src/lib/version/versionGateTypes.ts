export interface VersionGateConfig {
  latestVersion: string;
  minimumSupportedVersion: string;
  forceUpdate: boolean;
  updateType: "security" | "feature" | "maintenance" | "optional";
  maintenanceMode: boolean;
  message: string;
  playStoreUrl?: string;
  disabledFeatures?: string[];
  multiplayerEnabled: boolean;
  rustRealtimeEnabled: boolean;
  rankedArenaEnabled: boolean;
  challengeMatchEnabled: boolean;
  tournamentsEnabled: boolean;
  updatedAt?: number;
}

export type VersionGateDecision = 
  | "allowed"
  | "soft_update"
  | "force_update"
  | "maintenance"
  | "config_error_fallback"
  | "fallback_allowed";

export type VersionGateStatus = 
  | "checking"
  | "allowed"
  | "soft_update"
  | "force_update"
  | "maintenance"
  | "fallback_allowed";

export type DisabledFeatureKey = 
  | "multiplayer"
  | "rust_realtime"
  | "ranked_arena"
  | "challenge_match"
  | "tournaments";
