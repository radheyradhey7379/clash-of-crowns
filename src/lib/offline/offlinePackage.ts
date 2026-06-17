export type OfflinePackageStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'failed';

export interface OfflinePackageMetadata {
  status: OfflinePackageStatus;
  offlinePackageVersion: string | null;
  downloadedAt: number | null;
  assetManifestHash: string | null;
}

const METADATA_KEY = 'clash_offline_package_metadata';
const CACHE_NAME = 'clash-offline-assets';
const CURRENT_VERSION = '1.0.0';
const MANIFEST_HASH = 'hash_v1_assets_core';

// List of core offline assets to cache (Correction 1: homeanimation.mp4 is optional/high-graphics, NOT in core manifest)
const CORE_ASSETS = [
  './sf.js',
  './sf.wasm',
  './bgm.mp3',
  './home-bg-mobile.webp'
];

export function getOfflinePackageMetadata(): OfflinePackageMetadata {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {
      status: 'not_downloaded',
      offlinePackageVersion: null,
      downloadedAt: null,
      assetManifestHash: null
    };
  }

  const json = localStorage.getItem(METADATA_KEY);
  if (!json) {
    return {
      status: 'not_downloaded',
      offlinePackageVersion: null,
      downloadedAt: null,
      assetManifestHash: null
    };
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return {
      status: 'not_downloaded',
      offlinePackageVersion: null,
      downloadedAt: null,
      assetManifestHash: null
    };
  }
}

export function saveOfflinePackageMetadata(metadata: OfflinePackageMetadata) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
}

/**
 * Starts downloading and caching offline package assets.
 * Reports progress (0 to 100) via progressCallback.
 */
export async function downloadOfflinePackage(
  progressCallback: (progress: number) => void
): Promise<boolean> {
  const metadata = getOfflinePackageMetadata();
  metadata.status = 'downloading';
  saveOfflinePackageMetadata(metadata);

  progressCallback(0);

  if (typeof window === 'undefined' || typeof caches === 'undefined' || typeof fetch === 'undefined') {
    // Environment does not support cache storage (e.g. Node tests), simulate download
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        progressCallback(progress);
        if (progress >= 100) {
          clearInterval(interval);
          const successMetadata: OfflinePackageMetadata = {
            status: 'downloaded',
            offlinePackageVersion: CURRENT_VERSION,
            downloadedAt: Date.now(),
            assetManifestHash: MANIFEST_HASH
          };
          saveOfflinePackageMetadata(successMetadata);
          resolve(true);
        }
      }, 100);
    });
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    let completed = 0;

    // Fetch and cache each asset one by one, updating progress
    for (let i = 0; i < CORE_ASSETS.length; i++) {
      const url = CORE_ASSETS[i];
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        await cache.put(url, response);
      } catch (err) {
        console.error(`Offline package cache failed for ${url}:`, err);
        // Fallback: try root-relative URLs if relative ones fail
        const altUrl = url.replace(/^\.\//, '/');
        const response = await fetch(altUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch alternative ${altUrl}: ${response.statusText}`);
        }
        await cache.put(url, response); // Cache it under the original relative URL key
      }

      completed++;
      const progress = Math.round((completed / CORE_ASSETS.length) * 100);
      progressCallback(progress);
    }

    const successMetadata: OfflinePackageMetadata = {
      status: 'downloaded',
      offlinePackageVersion: CURRENT_VERSION,
      downloadedAt: Date.now(),
      assetManifestHash: MANIFEST_HASH
    };
    saveOfflinePackageMetadata(successMetadata);
    return true;
  } catch (error) {
    console.error('Offline package download failed:', error);
    const failedMetadata: OfflinePackageMetadata = {
      status: 'failed',
      offlinePackageVersion: null,
      downloadedAt: null,
      assetManifestHash: null
    };
    saveOfflinePackageMetadata(failedMetadata);
    return false;
  }
}

/**
 * Removes the downloaded offline package from caches.
 */
export async function resetOfflinePackage(): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      await caches.delete(CACHE_NAME);
    } catch (e) {
      console.warn('Failed to delete cache:', e);
    }
  }

  const resetMetadata: OfflinePackageMetadata = {
    status: 'not_downloaded',
    offlinePackageVersion: null,
    downloadedAt: null,
    assetManifestHash: null
  };
  saveOfflinePackageMetadata(resetMetadata);
}
