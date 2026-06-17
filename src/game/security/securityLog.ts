import { PlayerData, SecurityFlag } from '../../types';

/**
 * Logs a security event on the PlayerData object and returns the updated PlayerData.
 * Keeps only the last 100 security flags to prevent local storage bloat.
 */
export function logSecurityEvent(
  playerData: PlayerData,
  type: string,
  severity: 'low' | 'medium' | 'high',
  message: string
): PlayerData {
  const flags = [...(playerData.securityFlags || [])];

  const newFlag: SecurityFlag = {
    id: `flag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    severity,
    message,
    timestamp: Date.now()
  };

  flags.push(newFlag);

  // Keep only the latest 100 flags
  if (flags.length > 100) {
    flags.shift();
  }

  return {
    ...playerData,
    securityFlags: flags
  };
}
