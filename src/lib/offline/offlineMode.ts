import { OFFLINE_CAPABILITIES, OfflineFeatureKey } from './offlineCapabilities';
import { isOnline } from './networkStatus';

/**
 * Checks if the user is currently operating in offline mode.
 */
export function isOfflineMode(): boolean {
  return !isOnline();
}

/**
 * Checks if a specific feature can be used based on current network status.
 */
export function canUseFeature(featureKey: OfflineFeatureKey): boolean {
  if (isOnline()) {
    return true; // Any feature is allowed when online
  }
  return OFFLINE_CAPABILITIES[featureKey] || false;
}

/**
 * Returns true if a feature should be blocked due to lack of network connection.
 */
export function shouldBlockOnlineFeature(featureKey: OfflineFeatureKey): boolean {
  return isOfflineMode() && !OFFLINE_CAPABILITIES[featureKey];
}
