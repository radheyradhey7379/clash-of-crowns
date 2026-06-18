import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { VersionGateConfig, VersionGateDecision } from './versionGateTypes';
import { DEFAULT_VERSION_CONFIG } from './defaultVersionConfig';
import { getCurrentAppVersion, isVersionBelow, compareVersions } from './appVersion';

const CACHE_KEY = 'vgate_cache';
const TIMEOUT_MS = 2000;

/**
 * Fetches the version gate configuration from Firestore with a strict timeout.
 * Resolves to the config if successful, or null if it fails/times out.
 */
async function fetchRemoteConfig(): Promise<VersionGateConfig | null> {
  if (!db) return null;

  try {
    const fetchPromise = getDoc(doc(db, 'appConfig/versionGate'));
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), TIMEOUT_MS)
    );

    const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (docSnap && typeof docSnap === 'object' && 'exists' in docSnap && docSnap.exists()) {
      return docSnap.data() as VersionGateConfig;
    }
    return null;
  } catch (error) {
    console.warn('Failed to fetch version gate config:', error);
    return null;
  }
}

/**
 * Saves a valid remote config to localStorage for future offline use.
 */
function cacheConfig(config: VersionGateConfig) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to cache version gate config', e);
  }
}

/**
 * Retrieves the cached config from localStorage, if available.
 */
function getCachedConfig(): VersionGateConfig | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as VersionGateConfig;
    }
  } catch (e) {
    console.warn('Failed to read cached version gate config', e);
  }
  return null;
}

/**
 * Evaluates a configuration against the current app version to make a routing decision.
 * 
 * Priority:
 * 1. Maintenance Mode
 * 2. Force Update (explicit flag OR current version < minimum)
 * 3. Soft Update (current version < latest, but >= minimum)
 * 4. Allowed
 */
export function evaluateVersionGate(config: VersionGateConfig): VersionGateDecision {
  const currentVersion = getCurrentAppVersion();

  if (config.maintenanceMode) {
    return 'maintenance';
  }

  if (config.forceUpdate || isVersionBelow(currentVersion, config.minimumSupportedVersion)) {
    return 'force_update';
  }

  if (compareVersions(config.latestVersion, currentVersion) === 1) {
    return 'soft_update';
  }

  return 'allowed';
}

/**
 * Main entry point for the version gate. 
 * Fetches remote config, falls back to cache, then defaults.
 * Evaluates the final decision.
 */
export async function checkVersionGate(): Promise<{ config: VersionGateConfig, decision: VersionGateDecision }> {
  const remoteConfig = await fetchRemoteConfig();

  if (remoteConfig) {
    cacheConfig(remoteConfig);
    return {
      config: remoteConfig,
      decision: evaluateVersionGate(remoteConfig)
    };
  }

  // Fallback to cache if remote fails
  const cachedConfig = getCachedConfig();
  if (cachedConfig) {
    const decision = evaluateVersionGate(cachedConfig);
    
    // We only respect cached blocking states to keep security intact.
    // If cache says allowed, we return fallback_allowed to indicate offline mode.
    if (decision === 'maintenance' || decision === 'force_update') {
      return { config: cachedConfig, decision };
    }
    
    // If cache is safe/allowed, we ensure locally disabled features aren't accidentally enabled by stale cache
    const mergedSafeCache = { ...cachedConfig, ...DEFAULT_VERSION_CONFIG };
    return { config: mergedSafeCache, decision: 'fallback_allowed' };
  }

  // Final fallback (completely offline, no cache)
  return {
    config: DEFAULT_VERSION_CONFIG,
    decision: 'config_error_fallback'
  };
}
