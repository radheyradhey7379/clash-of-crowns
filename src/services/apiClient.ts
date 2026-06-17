/**
 * src/services/apiClient.ts
 * API helper to resolve absolute URLs in Capacitor/mobile environments
 * and relative URLs in web environments.
 */

export function getApiUrl(path: string): string {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || "";
  // Ensure we don't duplicate slashes
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}
