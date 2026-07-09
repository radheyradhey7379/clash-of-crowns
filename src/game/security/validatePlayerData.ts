import { PlayerData, AITier } from '../../types';
import { AI_CHARACTERS } from '../ai/aiCharacters';
import { getCurrentPlayableCharacterId } from '../ai/progressionEngine';
import { logSecurityEvent } from './securityLog';
import { DEFAULT_AI_PROGRESS } from '../ai/aiProgressDefaults';
import { detectSuspiciousSave } from './suspiciousSaveDetector';

/**
 * Validates the player data against simple constraints.
 * Returns true if valid, false if any constraint is violated.
 */
export function validatePlayerData(playerData: PlayerData): boolean {
  if (!playerData) return false;

  // Utilize the detector for baseline validation
  const detection = detectSuspiciousSave(playerData);
  if (detection.shouldBlockCloudUpload) {
    return false;
  }

  // Basic range validations
  if (typeof playerData.rating !== 'number' || playerData.rating < 0 || playerData.rating > 5000) return false;
  if (playerData.arenaRating !== undefined && (typeof playerData.arenaRating !== 'number' || playerData.arenaRating < 100 || playerData.arenaRating > 5000)) return false;
  if (playerData.appliedArenaResultIds !== undefined && (!Array.isArray(playerData.appliedArenaResultIds) || !playerData.appliedArenaResultIds.every(id => typeof id === 'string'))) return false;
  if (typeof playerData.coins !== 'number' || playerData.coins < 0 || playerData.coins > 10000000) return false;
  if (typeof playerData.xp !== 'number' || playerData.xp < 0 || playerData.xp > 50000000) return false;
  if (!Array.isArray(playerData.badges) || !playerData.badges.every(b => typeof b === 'string')) return false;

  const progress = playerData.aiProgress;
  if (!progress) return false;

  // AI Progress type validations
  const validTiers: AITier[] = ['beginner', 'learner', 'intermediate', 'hard', 'master', 'grandmaster'];
  if (!validTiers.includes(progress.tier)) return false;
  if (typeof progress.level !== 'number' || progress.level < 1) return false;
  if (typeof progress.elo !== 'number' || progress.elo < 0 || progress.elo > 5000) return false;

  // Verify lists
  if (!Array.isArray(progress.unlockedTiers) || !progress.unlockedTiers.every(t => validTiers.includes(t))) return false;
  if (!Array.isArray(progress.lockedTiers) || !progress.lockedTiers.every(t => validTiers.includes(t))) return false;

  // Check overlap
  const overlap = progress.unlockedTiers.some(t => progress.lockedTiers.includes(t));
  if (overlap) return false;

  // Sub-states checks
  if (!progress.promotionTrial || typeof progress.promotionTrial.unlocked !== 'boolean' || typeof progress.promotionTrial.completed !== 'boolean') return false;
  if (!progress.hard || typeof progress.hard.locked !== 'boolean') return false;
  if (!progress.masterCup || ![1, 2, 3].includes(progress.masterCup.currentCup) || progress.masterCup.currentMatch < 1 || progress.masterCup.currentMatch > 4) return false;
  if (progress.masterCup.winsInCup < 0 || progress.masterCup.winsInCup > 4 || progress.masterCup.lossesInCup < 0 || progress.masterCup.lossesInCup > 4) return false;
  if (!Array.isArray(progress.masterCup.completedCups)) return false;
  if (!progress.grandmaster || typeof progress.grandmaster.unlocked !== 'boolean' || typeof progress.grandmaster.bossDefeated !== 'boolean') return false;
  if (progress.grandmaster.bossSeriesWins < 0 || progress.grandmaster.bossSeriesWins > 2 || progress.grandmaster.bossSeriesLosses < 0 || progress.grandmaster.bossSeriesLosses > 2) return false;
  if (typeof progress.grandmaster.seasonPoints !== 'number' || progress.grandmaster.seasonPoints < 0) return false;

  // Verify current character exists
  try {
    const currentCharId = getCurrentPlayableCharacterId(progress);
    const currentCharExists = AI_CHARACTERS.some(c => c.id === currentCharId);
    if (!currentCharExists) return false;
  } catch (e) {
    return false;
  }

  // Consistency checks
  if (progress.unlockedTiers.includes('grandmaster') && !progress.masterCup.completedCups.includes(3)) return false;
  if (progress.unlockedTiers.includes('master') && !progress.unlockedTiers.includes('hard')) return false;
  if (progress.unlockedTiers.includes('hard') && !progress.unlockedTiers.includes('intermediate')) return false;
  if (progress.unlockedTiers.includes('intermediate') && !progress.unlockedTiers.includes('learner')) return false;
  if (progress.unlockedTiers.includes('learner') && !progress.unlockedTiers.includes('beginner')) return false;

  return true;
}

/**
 * Validates and repairs player data, returning a clean copy of PlayerData.
 * Appends flags to the returned player data if repairs were made.
 */
export function validateAndRepairPlayerData(playerData: PlayerData): {
  data: PlayerData;
  repaired: boolean;
  flags: { type: string; severity: 'low' | 'medium' | 'high'; message: string }[];
} {
  let repaired = false;
  const flags: { type: string; severity: 'low' | 'medium' | 'high'; message: string }[] = [];

  // Deep clone data to keep it immutable during repair
  let data = JSON.parse(JSON.stringify(playerData)) as PlayerData;

  // ELO Zero Migration & Safe Recovery logic
  const wins = data.wins || 0;
  const losses = data.losses || 0;
  const draws = data.draws || 0;
  const totalGames = Math.max(data.totalGames || 0, wins + losses + draws);
  const hasPlayed = totalGames > 0;

  if (!hasPlayed) {
    if (data.rating !== 0) {
      data.rating = 0;
      repaired = true;
      flags.push({
        type: 'zero_game_elo_migration',
        severity: 'low',
        message: 'Migrated unplayed user rating to 0 ELO'
      });
    }
    if (data.aiProgress && data.aiProgress.elo !== 0) {
      data.aiProgress.elo = 0;
      repaired = true;
    }
  }
  
  // Phase 32B Detection
  const detection = detectSuspiciousSave(data);
  if (detection.suspicious) {
    repaired = true; // We consider it repaired if we detected and handled suspicious things
    for (const flag of detection.flags) {
      flags.push({
        type: flag,
        severity: detection.severity === 'critical' ? 'high' : (detection.severity as 'low' | 'medium' | 'high'),
        message: `Suspicious data detected: ${flag}`
      });
    }
    
    // Auto-repair numeric corruptions from detector
    if (typeof data.coins === 'number' && (!Number.isFinite(data.coins) || isNaN(data.coins) || data.coins < 0 || data.coins > 10000000)) {
      data.coins = data.coins < 0 ? 0 : 10000000;
      if (isNaN(data.coins) || !Number.isFinite(data.coins)) data.coins = 0;
    }
    if (typeof data.xp === 'number' && (!Number.isFinite(data.xp) || isNaN(data.xp) || data.xp < 0 || data.xp > 50000000)) {
      data.xp = data.xp < 0 ? 0 : 50000000;
      if (isNaN(data.xp) || !Number.isFinite(data.xp)) data.xp = 0;
    }
    if (typeof data.rating === 'number' && (!Number.isFinite(data.rating) || isNaN(data.rating) || data.rating < 0 || data.rating > 5000)) {
      data.rating = data.rating < 0 ? 0 : 5000;
      if (isNaN(data.rating) || !Number.isFinite(data.rating)) data.rating = 0;
    }
  }

  // 1. Basic properties
  if (typeof data.rating !== 'number' || isNaN(data.rating) || data.rating < 0 || data.rating > 5000) {
    const oldVal = data.rating;
    data.rating = (typeof data.rating !== 'number' || isNaN(data.rating) || data.rating < 0) ? 0 : data.rating > 5000 ? 5000 : 0;
    repaired = true;
    flags.push({
      type: 'invalid_elo_cap',
      severity: 'high',
      message: `Repaired ELO from ${oldVal} to ${data.rating}`
    });
  }

  if (typeof data.coins !== 'number' || data.coins < 0 || data.coins > 10000000) {
    const oldVal = data.coins;
    data.coins = data.coins < 0 ? 0 : data.coins > 10000000 ? 10000000 : 0;
    repaired = true;
    flags.push({
      type: 'invalid_coin_cap',
      severity: 'high',
      message: `Repaired coins from ${oldVal} to ${data.coins}`
    });
  }

  if (typeof data.xp !== 'number' || data.xp < 0 || data.xp > 50000000) {
    const oldVal = data.xp;
    data.xp = data.xp < 0 ? 0 : data.xp > 50000000 ? 50000000 : 0;
    repaired = true;
    flags.push({
      type: 'invalid_xp_cap',
      severity: 'high',
      message: `Repaired XP from ${oldVal} to ${data.xp}`
    });
  }

  if (!Array.isArray(data.badges) || !data.badges.every(b => typeof b === 'string')) {
    data.badges = Array.isArray(data.badges) ? data.badges.filter(b => typeof b === 'string') : [];
    repaired = true;
    flags.push({
      type: 'invalid_badge_array',
      severity: 'high',
      message: 'Repaired invalid badges structure'
    });
  }

  
  if (data.commentaryEnabled === undefined) {
    data.commentaryEnabled = false;
    repaired = true;
  }

  if (data.viewMode !== '2d' && data.viewMode !== '3d') {
    data.viewMode = '3d';
    repaired = true;
  }
  if (data.whiteGames === undefined || typeof data.whiteGames !== 'number') { data.whiteGames = 0; repaired = true; }
  if (data.whiteWins === undefined || typeof data.whiteWins !== 'number') { data.whiteWins = 0; repaired = true; }
  if (data.whiteLosses === undefined || typeof data.whiteLosses !== 'number') { data.whiteLosses = 0; repaired = true; }
  if (data.whiteDraws === undefined || typeof data.whiteDraws !== 'number') { data.whiteDraws = 0; repaired = true; }
  if (data.blackGames === undefined || typeof data.blackGames !== 'number') { data.blackGames = 0; repaired = true; }
  if (data.blackWins === undefined || typeof data.blackWins !== 'number') { data.blackWins = 0; repaired = true; }
  if (data.blackLosses === undefined || typeof data.blackLosses !== 'number') { data.blackLosses = 0; repaired = true; }
  if (data.blackDraws === undefined || typeof data.blackDraws !== 'number') { data.blackDraws = 0; repaired = true; }
  if (data.totalGames === undefined || typeof data.totalGames !== 'number') { data.totalGames = 0; repaired = true; }
  if (data.totalWins === undefined || typeof data.totalWins !== 'number') { data.totalWins = 0; repaired = true; }
  if (data.totalLosses === undefined || typeof data.totalLosses !== 'number') { data.totalLosses = 0; repaired = true; }
  if (data.totalDraws === undefined || typeof data.totalDraws !== 'number') { data.totalDraws = 0; repaired = true; }
  if (data.arenaRating === undefined || typeof data.arenaRating !== 'number' || data.arenaRating < 100 || data.arenaRating > 5000) {
    const oldVal = data.arenaRating;
    data.arenaRating = (data.arenaRating !== undefined && typeof data.arenaRating === 'number' && data.arenaRating < 100) ? 100 : (data.arenaRating !== undefined && typeof data.arenaRating === 'number' && data.arenaRating > 5000) ? 5000 : 1200;
    repaired = true;
    flags.push({
      type: 'invalid_arena_rating_cap',
      severity: 'high',
      message: `Repaired arena rating from ${oldVal} to ${data.arenaRating}`
    });
  }

  if (!data.appliedArenaResultIds || !Array.isArray(data.appliedArenaResultIds) || !data.appliedArenaResultIds.every(id => typeof id === 'string')) {
    data.appliedArenaResultIds = Array.isArray(data.appliedArenaResultIds) ? data.appliedArenaResultIds.filter(id => typeof id === 'string') : [];
    repaired = true;
  }

  // Ensure aiProgress structure exists
  if (!data.aiProgress) {
    data.aiProgress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
    data.aiProgress.elo = data.rating;
    repaired = true;
    flags.push({
      type: 'missing_ai_progress',
      severity: 'high',
      message: 'Reconstructed missing AI progression system'
    });
  }

  const progress = data.aiProgress;

  // Migrate legacy tiers first
  if (progress.tier === ('core' as any)) {
    progress.tier = 'beginner';
    progress.level = 1;
    progress.elo = Math.max(0, progress.elo);
    repaired = true;
  } else if (progress.tier === ('promotion_trial' as any)) {
    progress.tier = 'learner';
    progress.level = 5;
    repaired = true;
  }

  if (progress.unlockedTiers && (progress.unlockedTiers.includes('core' as any) || progress.unlockedTiers.includes('promotion_trial' as any))) {
    progress.unlockedTiers = progress.unlockedTiers.filter((t: any) => t !== 'core' && t !== 'promotion_trial');
    if (!progress.unlockedTiers.includes('beginner')) {
      progress.unlockedTiers.unshift('beginner');
    }
    repaired = true;
  }

  if (progress.lockedTiers && (progress.lockedTiers.includes('core' as any) || progress.lockedTiers.includes('promotion_trial' as any))) {
    progress.lockedTiers = progress.lockedTiers.filter((t: any) => t !== 'core' && t !== 'promotion_trial');
    repaired = true;
  }

  const validTiers: AITier[] = ['beginner', 'learner', 'intermediate', 'hard', 'master', 'grandmaster'];

  if (!validTiers.includes(progress.tier)) {
    progress.tier = 'beginner';
    repaired = true;
    flags.push({
      type: 'invalid_tier',
      severity: 'high',
      message: 'Reset invalid tier to beginner'
    });
  }

  if (typeof progress.level !== 'number' || progress.level < 1) {
    progress.level = 1;
    repaired = true;
    flags.push({
      type: 'invalid_level',
      severity: 'medium',
      message: 'Reset invalid progression level to 1'
    });
  }

  if (typeof progress.elo !== 'number' || progress.elo < 0 || progress.elo > 5000) {
    progress.elo = progress.elo < 0 ? 0 : progress.elo > 5000 ? 5000 : 0;
    repaired = true;
    flags.push({
      type: 'invalid_career_elo',
      severity: 'high',
      message: `Repaired career ELO to ${progress.elo}`
    });
  }

  // Synchronize overall rating with career ELO if mismatched
  if (data.rating !== progress.elo) {
    data.rating = progress.elo;
    repaired = true;
    flags.push({
      type: 'elo_mismatch_repaired',
      severity: 'medium',
      message: `Synced overall rating with career ELO (${progress.elo})`
    });
  }

  // Lists integrity
  if (!Array.isArray(progress.unlockedTiers)) {
    progress.unlockedTiers = ['beginner'];
    repaired = true;
  }
  progress.unlockedTiers = progress.unlockedTiers.filter((t: any) => validTiers.includes(t));
  if (progress.unlockedTiers.length === 0) {
    progress.unlockedTiers.push('beginner');
  }

  if (!Array.isArray(progress.lockedTiers)) {
    progress.lockedTiers = ['learner', 'intermediate', 'hard', 'master', 'grandmaster'];
    repaired = true;
  }
  progress.lockedTiers = progress.lockedTiers.filter((t: any) => validTiers.includes(t));

  // Phase 33A: Migrate claimed rewards to prevent duplicates
  if (!Array.isArray(progress.claimedTierRewards)) {
    progress.claimedTierRewards = [];
    repaired = true;
  } else {
    progress.claimedTierRewards = progress.claimedTierRewards.filter((t: any) => validTiers.includes(t));
  }

  // Overlap repair
  const overlaps = progress.unlockedTiers.filter(t => progress.lockedTiers.includes(t));
  if (overlaps.length > 0) {
    progress.lockedTiers = progress.lockedTiers.filter(t => !progress.unlockedTiers.includes(t));
    repaired = true;
    flags.push({
      type: 'tier_list_overlap',
      severity: 'high',
      message: `Removed overlaps from lockedTiers: ${overlaps.join(', ')}`
    });
  }

  // Sub-states checks
  if (!progress.promotionTrial) {
    progress.promotionTrial = { unlocked: false, completed: false };
    repaired = true;
  }
  if (typeof progress.promotionTrial.unlocked !== 'boolean') {
    progress.promotionTrial.unlocked = false;
    repaired = true;
  }
  if (typeof progress.promotionTrial.completed !== 'boolean') {
    progress.promotionTrial.completed = false;
    repaired = true;
  }

  if (!progress.hard) {
    progress.hard = { locked: true };
    repaired = true;
  }
  if (typeof progress.hard.locked !== 'boolean') {
    progress.hard.locked = true;
    repaired = true;
  }

  if (!progress.masterCup) {
    progress.masterCup = { currentCup: 1, currentMatch: 1, winsInCup: 0, lossesInCup: 0, completedCups: [] };
    repaired = true;
  }
  if (![1, 2, 3].includes(progress.masterCup.currentCup)) {
    progress.masterCup.currentCup = 1;
    repaired = true;
    flags.push({
      type: 'invalid_master_cup',
      severity: 'high',
      message: 'Reset invalid master cup number'
    });
  }
  if (progress.masterCup.currentMatch < 1 || progress.masterCup.currentMatch > 4) {
    progress.masterCup.currentMatch = 1;
    repaired = true;
    flags.push({
      type: 'invalid_master_match',
      severity: 'medium',
      message: 'Reset invalid master cup match index'
    });
  }
  if (progress.masterCup.winsInCup < 0 || progress.masterCup.winsInCup > 4) {
    progress.masterCup.winsInCup = 0;
    repaired = true;
  }
  if (progress.masterCup.lossesInCup < 0 || progress.masterCup.lossesInCup > 4) {
    progress.masterCup.lossesInCup = 0;
    repaired = true;
  }
  if (!Array.isArray(progress.masterCup.completedCups)) {
    progress.masterCup.completedCups = [];
    repaired = true;
  }
  progress.masterCup.completedCups = progress.masterCup.completedCups.filter(c => [1, 2, 3].includes(c));

  // Phase 33A: Migrate claimed cup rewards
  if (!Array.isArray(progress.claimedCupRewards)) {
    progress.claimedCupRewards = [...progress.masterCup.completedCups];
    repaired = true;
  } else {
    progress.claimedCupRewards = progress.claimedCupRewards.filter(c => [1, 2, 3].includes(c));
  }

  if (!progress.grandmaster) {
    progress.grandmaster = { unlocked: false, bossDefeated: false, bossSeriesWins: 0, bossSeriesLosses: 0, seasonPoints: 0 };
    repaired = true;
  }
  if (typeof progress.grandmaster.unlocked !== 'boolean') {
    progress.grandmaster.unlocked = false;
    repaired = true;
  }
  if (typeof progress.grandmaster.bossDefeated !== 'boolean') {
    progress.grandmaster.bossDefeated = false;
    repaired = true;
  }
  if (progress.grandmaster.bossSeriesWins < 0 || progress.grandmaster.bossSeriesWins > 2) {
    progress.grandmaster.bossSeriesWins = 0;
    repaired = true;
  }
  if (progress.grandmaster.bossSeriesLosses < 0 || progress.grandmaster.bossSeriesLosses > 2) {
    progress.grandmaster.bossSeriesLosses = 0;
    repaired = true;
  }
  if (typeof progress.grandmaster.seasonPoints !== 'number' || progress.grandmaster.seasonPoints < 0) {
    progress.grandmaster.seasonPoints = 0;
    repaired = true;
  }

  // 2. Progression consistency & impossible state checks
  // Grandmaster unlocked without Master Cup 3 completed
  if (progress.unlockedTiers.includes('grandmaster') && !progress.masterCup.completedCups.includes(3)) {
    progress.tier = 'master';
    progress.level = 9; // Reset to start of Cup 3
    progress.masterCup.currentCup = 3;
    progress.masterCup.currentMatch = 1;
    progress.masterCup.winsInCup = 0;
    progress.masterCup.lossesInCup = 0;
    progress.grandmaster.unlocked = false;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'grandmaster');
    if (!progress.lockedTiers.includes('grandmaster')) {
      progress.lockedTiers.push('grandmaster');
    }
    repaired = true;
    flags.push({
      type: 'impossible_grandmaster_state',
      severity: 'high',
      message: 'Locked Grandmaster: Master Cup 3 was not completed'
    });
  }

  // Master unlocked without Hard 8 completed
  if (progress.unlockedTiers.includes('master') && !progress.unlockedTiers.includes('hard')) {
    progress.tier = 'hard';
    progress.level = 1;
    progress.hard.locked = false;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'master' && t !== 'grandmaster');
    if (!progress.unlockedTiers.includes('hard')) {
      progress.unlockedTiers.push('hard');
    }
    repaired = true;
    flags.push({
      type: 'impossible_master_state',
      severity: 'high',
      message: 'Locked Master: Hard tier was not completed'
    });
  }

  // Hard unlocked without Intermediate 8 completed
  if (progress.unlockedTiers.includes('hard') && !progress.unlockedTiers.includes('intermediate')) {
    progress.tier = 'intermediate';
    progress.level = 1;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'hard' && t !== 'master' && t !== 'grandmaster');
    repaired = true;
    flags.push({
      type: 'impossible_hard_state',
      severity: 'high',
      message: 'Locked Hard: Intermediate tier was not completed'
    });
  }

  // intermediate unlocked but promotionTrial not completed
  if (progress.unlockedTiers.includes('intermediate') && progress.promotionTrial && !progress.promotionTrial.completed) {
    progress.tier = 'learner';
    progress.level = 5;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'intermediate' && t !== 'hard' && t !== 'master' && t !== 'grandmaster');
    repaired = true;
    flags.push({
      type: 'impossible_intermediate_state',
      severity: 'high',
      message: 'Locked Intermediate: Promotion trial was not completed'
    });
  }

  // Intermediate unlocked without Learner completed
  if (progress.unlockedTiers.includes('intermediate') && !progress.unlockedTiers.includes('learner')) {
    progress.tier = 'learner';
    progress.level = 1;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'intermediate' && t !== 'hard' && t !== 'master' && t !== 'grandmaster');
    repaired = true;
    flags.push({
      type: 'impossible_intermediate_state',
      severity: 'high',
      message: 'Locked Intermediate: Learner tier was not completed'
    });
  }

  // Learner unlocked without Beginner completed
  if (progress.unlockedTiers.includes('learner') && !progress.unlockedTiers.includes('beginner')) {
    progress.tier = 'beginner';
    progress.level = 1;
    progress.unlockedTiers = progress.unlockedTiers.filter(t => t !== 'learner' && t !== 'intermediate' && t !== 'hard' && t !== 'master' && t !== 'grandmaster');
    repaired = true;
    flags.push({
      type: 'impossible_learner_state',
      severity: 'high',
      message: 'Locked Learner: Beginner tier was not completed'
    });
  }

  // Final check: character ID existence validation
  try {
    const currentCharId = getCurrentPlayableCharacterId(progress);
    const currentCharExists = AI_CHARACTERS.some(c => c.id === currentCharId);
    if (!currentCharExists) {
      // Complete progression reset
      data.aiProgress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
      data.rating = DEFAULT_AI_PROGRESS.elo;
      repaired = true;
      flags.push({
        type: 'invalid_character_resolution',
        severity: 'high',
        message: `Failed to resolve character ID: ${currentCharId}. Career progression was reset.`
      });
    }
  } catch (e) {
    data.aiProgress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
    data.rating = DEFAULT_AI_PROGRESS.elo;
    repaired = true;
    flags.push({
      type: 'invalid_character_resolution',
      severity: 'high',
      message: 'Critical error resolving current character. Career progression was reset.'
    });
  }

  // Apply all generated flags
  for (const f of flags) {
    data = logSecurityEvent(data, f.type, f.severity, f.message);
  }

  // Phase 32B Save Integrity Metadata Stamp
  data.integrityLevel = repaired ? "suspicious_repaired" : "validated";
  data.saveVersion = data.saveVersion || 1;
  data.lastValidatedAt = Date.now();
  data.suspiciousFlags = flags.map(f => f.type);

  return {
    data,
    repaired,
    flags
  };
}
