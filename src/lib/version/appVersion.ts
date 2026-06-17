/**
 * Returns the current application version.
 * Falls back to '1.0.0' if not available in the environment.
 */
export function getCurrentAppVersion(): string {
  // Use Vite env variable if available, otherwise default to 1.0.0
  // Note: import.meta.env might not be available in all test contexts, so we safely fallback
  try {
    return import.meta.env?.VITE_APP_VERSION || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
}

/**
 * Compares two semantic version strings (e.g., '1.0.0', '1.2.0-beta').
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a === b
 */
export function compareVersions(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const aParts = a.replace(/[^0-9.]/g, '').split('.').map(Number);
  const bParts = b.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  
  return 0;
}

/**
 * Checks if the current version is strictly below the minimum version.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) === -1;
}
