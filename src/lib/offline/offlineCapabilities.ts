export type OfflineFeatureKey =
  | 'aiCareer'
  | 'playComputer'
  | 'localProfile'
  | 'settings'
  | 'customization'
  | 'multiplayer'
  | 'cloudSave'
  | 'leaderboard'
  | 'premiumPurchase'
  | 'chat';

/**
 * Maps feature keys to whether they are allowed to run completely offline.
 */
export const OFFLINE_CAPABILITIES: Record<OfflineFeatureKey, boolean> = {
  aiCareer: true,
  playComputer: true,
  localProfile: true,
  settings: true,
  customization: true,
  multiplayer: false,
  cloudSave: false,
  leaderboard: false,
  premiumPurchase: false,
  chat: false,
};
