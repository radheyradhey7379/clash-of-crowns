import { PlayerData, AIProgress, AITier } from '../../types';
import { validatePlayerData, validateAndRepairPlayerData } from '../../game/security/validatePlayerData';

const TIER_ORDER: AITier[] = ['beginner', 'learner', 'intermediate', 'hard', 'master', 'grandmaster'];

/**
 * Returns a score representing the player's career progress.
 */
function getProgressRank(progress: AIProgress): number {
  if (!progress) return 0;
  const tierIndex = TIER_ORDER.indexOf(progress.tier);
  return (tierIndex >= 0 ? tierIndex : 0) * 100 + (progress.level || 1);
}

/**
 * Resolves a cloud save vs a local save.
 * If local is newer, it suggests uploading local.
 * If cloud is newer, it suggests restoring or merging.
 */
export function resolveCloudVsLocal(
  localData: PlayerData,
  localUpdatedAt: number,
  cloudData: PlayerData,
  cloudUpdatedAt: number
): {
  action: 'upload_local' | 'restore_cloud' | 'merge' | 'keep_local_log_conflict';
  resolvedData: PlayerData;
} {
  const isLocalValid = validatePlayerData(localData);
  const isCloudValid = validatePlayerData(cloudData);

  // Correction 1: Reject invalid sides
  if (!isLocalValid && isCloudValid) {
    console.warn('[ConflictResolver] Local save is invalid, restoring cloud save.');
    return { action: 'restore_cloud', resolvedData: cloudData };
  }
  if (isLocalValid && !isCloudValid) {
    console.warn('[ConflictResolver] Cloud save is invalid, keeping local save.');
    return { action: 'upload_local', resolvedData: localData };
  }
  if (!isLocalValid && !isCloudValid) {
    console.error('[ConflictResolver] Both local and cloud saves are invalid!');
    return { action: 'keep_local_log_conflict', resolvedData: localData };
  }

  // Reset marker conflict protection
  const localResetTime = localData.lastResetAt ? new Date(localData.lastResetAt).getTime() : 0;
  const cloudResetTime = cloudData.lastResetAt ? new Date(cloudData.lastResetAt).getTime() : 0;

  if (localResetTime > cloudResetTime) {
    console.log('[ConflictResolver] Local save has a newer reset marker. Keeping local.');
    return { action: 'upload_local', resolvedData: localData };
  }
  if (cloudResetTime > localResetTime) {
    console.log('[ConflictResolver] Cloud save has a newer reset marker. Restoring cloud.');
    return { action: 'restore_cloud', resolvedData: cloudData };
  }

  // Phase 32B: Cloud Conflict protection
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // If cloud timestamp is from far future, it's suspicious. Reject it.
  if (cloudUpdatedAt > now + ONE_DAY) {
    console.warn('[ConflictResolver] Cloud save has a future timestamp. Treating as suspicious and keeping local.');
    return { action: 'upload_local', resolvedData: localData };
  }

  // Both are valid
  if (localUpdatedAt > cloudUpdatedAt) {
    return { action: 'upload_local', resolvedData: localData };
  }

  if (cloudUpdatedAt > localUpdatedAt) {
    // Cloud is clearly newer, perform safe merge
    const merged = mergeSafeProgress(localData, cloudData);
    return { action: 'merge', resolvedData: merged };
  }

  // Conflict is unclear (equal timestamps or invalid)
  console.log('[ConflictResolver] Save timestamp conflict is unclear. Keeping local, logging conflict.');
  return { action: 'keep_local_log_conflict', resolvedData: localData };
}

/**
 * Checks if local save is newer.
 */
export function isLocalNewer(localUpdatedAt: number, cloudUpdatedAt: number): boolean {
  return localUpdatedAt > cloudUpdatedAt;
}

/**
 * Checks if cloud save is newer.
 */
export function isCloudNewer(localUpdatedAt: number, cloudUpdatedAt: number): boolean {
  return cloudUpdatedAt > localUpdatedAt;
}

/**
 * Performs a safe merge of local and cloud player data.
 * Merges career progression, coins, ELO, XP and badges while respecting local device settings.
 */
export function mergeSafeProgress(localData: PlayerData, cloudData: PlayerData): PlayerData {
  // Ensure we are working with deep copies to maintain immutability
  const local = JSON.parse(JSON.stringify(localData)) as PlayerData;
  const cloud = JSON.parse(JSON.stringify(cloudData)) as PlayerData;

  // Union of badges
  const mergedBadges = Array.from(new Set([
    ...(local.badges || []),
    ...(cloud.badges || [])
  ]));

  // Safe ELO/coins/XP merging
  const mergedRating = Math.max(local.rating || 0, cloud.rating || 0);
  const mergedCoins = Math.max(local.coins || 0, cloud.coins || 0);
  const mergedXp = Math.max(local.xp || 0, cloud.xp || 0);

  const mergedWins = Math.max(local.wins || 0, cloud.wins || 0);
  const mergedLosses = Math.max(local.losses || 0, cloud.losses || 0);
  const mergedDraws = Math.max(local.draws || 0, cloud.draws || 0);
  const mergedStreak = Math.max(local.streak || 0, cloud.streak || 0);
  const mergedBestStreak = Math.max(local.bestStreak || 0, cloud.bestStreak || 0);

  // Side wins/times
  const mergedWhiteWins = Math.max(local.whiteWins || 0, cloud.whiteWins || 0);
  const mergedWhiteLosses = Math.max(local.whiteLosses || 0, cloud.whiteLosses || 0);
  const mergedBlackWins = Math.max(local.blackWins || 0, cloud.blackWins || 0);
  const mergedBlackLosses = Math.max(local.blackLosses || 0, cloud.blackLosses || 0);
  const mergedWhiteTime = Math.max(local.whiteTime || 0, cloud.whiteTime || 0);
  const mergedBlackTime = Math.max(local.blackTime || 0, cloud.blackTime || 0);

  // AI Progress merging
  const localRank = getProgressRank(local.aiProgress);
  const cloudRank = getProgressRank(cloud.aiProgress);

  let mergedAiProgress: AIProgress;
  const baseProgress = localRank >= cloudRank ? local.aiProgress : cloud.aiProgress;
  const altProgress = localRank >= cloudRank ? cloud.aiProgress : local.aiProgress;

  // Create deep copy of the base progress as starting point
  mergedAiProgress = JSON.parse(JSON.stringify(baseProgress));

  // Merge unlocked tiers (union)
  mergedAiProgress.unlockedTiers = Array.from(new Set([
    ...baseProgress.unlockedTiers,
    ...altProgress.unlockedTiers
  ])) as AITier[];

  // lockedTiers should be all possible tiers minus unlockedTiers
  mergedAiProgress.lockedTiers = TIER_ORDER.filter(t => !mergedAiProgress.unlockedTiers.includes(t)) as AITier[];

  // Merge promotion trial completion
  mergedAiProgress.promotionTrial = {
    unlocked: baseProgress.promotionTrial.unlocked || altProgress.promotionTrial.unlocked,
    completed: baseProgress.promotionTrial.completed || altProgress.promotionTrial.completed
  };

  // Merge hard unlock
  mergedAiProgress.hard = {
    locked: baseProgress.hard.locked && altProgress.hard.locked
  };

  // Merge master cups
  const mergedCompletedCups = Array.from(new Set([
    ...(baseProgress.masterCup.completedCups || []),
    ...(altProgress.masterCup.completedCups || [])
  ]));
  mergedAiProgress.masterCup.completedCups = mergedCompletedCups;

  // Merge grandmaster details
  mergedAiProgress.grandmaster = {
    unlocked: baseProgress.grandmaster.unlocked || altProgress.grandmaster.unlocked,
    bossDefeated: baseProgress.grandmaster.bossDefeated || altProgress.grandmaster.bossDefeated,
    bossSeriesWins: Math.max(baseProgress.grandmaster.bossSeriesWins || 0, altProgress.grandmaster.bossSeriesWins || 0),
    bossSeriesLosses: Math.max(baseProgress.grandmaster.bossSeriesLosses || 0, altProgress.grandmaster.bossSeriesLosses || 0),
    seasonPoints: Math.max(baseProgress.grandmaster.seasonPoints || 0, altProgress.grandmaster.seasonPoints || 0)
  };

  // Force rating sync inside aiProgress
  mergedAiProgress.elo = mergedRating;

  // 3. Assemble merged object, preferring local settings
  const mergedPlayerData: PlayerData = {
    ...local,
    // Carry over auth details
    uid: local.uid || cloud.uid,
    photoURL: local.photoURL || cloud.photoURL,
    
    // Merged stats
    rating: mergedRating,
    coins: mergedCoins,
    xp: mergedXp,
    wins: mergedWins,
    losses: mergedLosses,
    draws: mergedDraws,
    streak: mergedStreak,
    bestStreak: mergedBestStreak,
    badges: mergedBadges,
    isPremium: local.isPremium || cloud.isPremium,
    
    whiteWins: mergedWhiteWins,
    whiteLosses: mergedWhiteLosses,
    blackWins: mergedBlackWins,
    blackLosses: mergedBlackLosses,
    whiteTime: mergedWhiteTime,
    blackTime: mergedBlackTime,

    // Merged AI Progress
    aiProgress: mergedAiProgress,

    // Carry over deviceId if available
    deviceId: local.deviceId || cloud.deviceId
  };

  // Run through standard validateAndRepairPlayerData to ensure consistency bounds
  const repairResult = validateAndRepairPlayerData(mergedPlayerData);
  return repairResult.data;
}
