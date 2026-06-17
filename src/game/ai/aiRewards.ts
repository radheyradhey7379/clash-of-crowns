import { AIProgress, AITier } from '../../types/aiProgression';

export interface RewardResult {
  coins: number;
  xp: number;
  badge?: string;
  tierUnlocked?: AITier | null;
  cupCompleted?: number | null;
  bossDefeated?: boolean;
  newlyClaimedTierRewards: AITier[];
  newlyClaimedCupRewards: number[];
}

export function getEloChangeOnWin(tier: AITier): number {
  if (tier === 'grandmaster') return 30;
  return 25;
}

export function getEloChangeOnLoss(tier: AITier): number {
  if (tier === 'core' || tier === 'beginner') return 0;
  if (tier === 'grandmaster') return -25;
  if (tier === 'hard') return -20;
  return -15;
}

export function calculateAIMatchRewards(
  result: 'win' | 'loss' | 'draw',
  oldProgress: AIProgress,
  newProgress: AIProgress
): RewardResult {
  let coins = 0;
  let xp = 0;
  let badge: string | undefined = undefined;
  let tierUnlocked: AITier | null = null;
  let cupCompleted: number | null = null;
  let bossDefeated = false;
  const newlyClaimedTierRewards: AITier[] = [];
  const newlyClaimedCupRewards: number[] = [];

  // Base rewards
  if (result === 'win') {
    coins += 50;
    xp += 100;
  } else if (result === 'draw') {
    coins += 20;
    xp += 40;
  } else if (result === 'loss') {
    xp += 10;
  }

  // Tier unlock bonus: +200 coins
  // Phase 33A: Only award if NOT previously claimed
  const newlyUnlockedTiers = newProgress.unlockedTiers.filter(t => !oldProgress.unlockedTiers.includes(t));
  for (const t of newlyUnlockedTiers) {
    if (!oldProgress.claimedTierRewards?.includes(t)) {
      coins += 200;
      tierUnlocked = t;
      newlyClaimedTierRewards.push(t);
    }
  }

  // Master cup clear bonus: +500 coins
  // Phase 33A: Only award if NOT previously claimed
  const newlyCompletedCups = newProgress.masterCup.completedCups.filter(c => !oldProgress.masterCup.completedCups.includes(c));
  for (const c of newlyCompletedCups) {
    if (!oldProgress.claimedCupRewards?.includes(c)) {
      coins += 500;
      cupCompleted = c;
      newlyClaimedCupRewards.push(c);
    }
  }

  // Grandmaster boss defeated: special badge "Grandmaster Boss Slayer"
  if (newProgress.grandmaster.bossDefeated && !oldProgress.grandmaster.bossDefeated) {
    badge = 'Grandmaster Boss Slayer';
    bossDefeated = true;
  }

  return {
    coins,
    xp,
    badge,
    tierUnlocked,
    cupCompleted,
    bossDefeated,
    newlyClaimedTierRewards,
    newlyClaimedCupRewards
  };
}
