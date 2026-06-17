import { PlayerData } from '../../types';

export interface SuspiciousDetectionResult {
  suspicious: boolean;
  severity: "none" | "low" | "medium" | "high" | "critical";
  flags: string[];
  shouldBlockCloudUpload: boolean;
  shouldBlockLeaderboardUpload: boolean;
}

export function detectSuspiciousSave(data: PlayerData | null | undefined): SuspiciousDetectionResult {
  if (!data) {
    return {
      suspicious: true,
      severity: 'critical',
      flags: ['missing_data'],
      shouldBlockCloudUpload: true,
      shouldBlockLeaderboardUpload: true
    };
  }

  const flags: string[] = [];
  let severity: "none" | "low" | "medium" | "high" | "critical" = 'none';
  let blockCloud = false;
  let blockLeaderboard = false;

  const addFlag = (flag: string, level: "low" | "medium" | "high" | "critical", blockUploads: boolean) => {
    flags.push(flag);
    if (level === 'critical') severity = 'critical';
    else if (level === 'high' && severity !== 'critical') severity = 'high';
    else if (level === 'medium' && severity !== 'high' && severity !== 'critical') severity = 'medium';
    else if (level === 'low' && severity === 'none') severity = 'low';

    if (blockUploads) {
      blockCloud = true;
      blockLeaderboard = true;
    }
  };

  // Basic numeric checks
  if (typeof data.coins === 'number') {
    if (!Number.isFinite(data.coins) || isNaN(data.coins)) addFlag('non_finite_coins', 'critical', true);
    else if (data.coins < 0) addFlag('negative_coins', 'high', true);
    else if (data.coins > 10000000) addFlag('impossible_coins_cap', 'high', true);
  }

  if (typeof data.xp === 'number') {
    if (!Number.isFinite(data.xp) || isNaN(data.xp)) addFlag('non_finite_xp', 'critical', true);
    else if (data.xp < 0) addFlag('negative_xp', 'high', true);
    else if (data.xp > 50000000) addFlag('impossible_xp_cap', 'high', true);
  }

  if (typeof data.rating === 'number') {
    if (!Number.isFinite(data.rating) || isNaN(data.rating)) addFlag('non_finite_rating', 'critical', true);
    else if (data.rating < 0) addFlag('negative_rating', 'high', true);
    else if (data.rating > 5000) addFlag('impossible_rating_cap', 'high', true);
  }

  if (data.arenaRating !== undefined && typeof data.arenaRating === 'number') {
    if (!Number.isFinite(data.arenaRating) || isNaN(data.arenaRating)) addFlag('non_finite_arena_rating', 'critical', true);
    else if (data.arenaRating < 0) addFlag('negative_arena_rating', 'high', true);
    else if (data.arenaRating > 5000) addFlag('impossible_arena_rating_cap', 'high', true);
  }

  // Future timestamps (allow 1 day clock skew leeway)
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (data.lastValidatedAt && data.lastValidatedAt > now + ONE_DAY) {
    addFlag('future_validation_timestamp', 'medium', true);
  }
  if (data.lastRewardAt && data.lastRewardAt > now + ONE_DAY) {
    addFlag('future_reward_timestamp', 'medium', true);
  }

  // Progression logic checks
  if (data.aiProgress) {
    const p = data.aiProgress;
    
    // ELO Mismatch (allowing small desyncs but flag large ones)
    if (Math.abs((data.rating || 0) - (p.elo || 0)) > 50) {
      addFlag('rating_elo_mismatch', 'medium', false);
    }

    if (p.elo !== undefined && (!Number.isFinite(p.elo) || isNaN(p.elo) || p.elo < 0 || p.elo > 5000)) {
      addFlag('invalid_progression_elo', 'high', true);
    }

    // Impossible Unlocks
    const unlocked = Array.isArray(p.unlockedTiers) ? p.unlockedTiers : [];
    
    if (unlocked.includes('grandmaster')) {
      if (!p.masterCup?.completedCups?.includes(3)) {
        addFlag('impossible_grandmaster_unlock', 'high', true);
      }
    }

    if (unlocked.includes('master') && !unlocked.includes('hard')) {
      addFlag('impossible_master_unlock', 'high', true);
    }

    // Match count vs tier jump
    if (data.totalMatchesCompleted !== undefined) {
      // Treat strictly only if saveVersion >= 2 (newly created in 33A or later)
      // Otherwise it's advisory (medium) to prevent blocking legacy migrated users.
      const isStrict = data.saveVersion !== undefined && data.saveVersion >= 2;
      const severity = isStrict ? 'high' : 'medium';

      if (unlocked.includes('master') && data.totalMatchesCompleted < 20) {
        addFlag('impossible_matches_for_master', severity, isStrict);
      }
      if (unlocked.includes('grandmaster') && data.totalMatchesCompleted < 30) {
        addFlag('impossible_matches_for_grandmaster', severity, isStrict);
      }
    }
  }

  return {
    suspicious: severity !== 'none',
    severity,
    flags,
    shouldBlockCloudUpload: blockCloud,
    shouldBlockLeaderboardUpload: blockLeaderboard
  };
}
