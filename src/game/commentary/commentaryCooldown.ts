export interface CooldownState {
  lastReactionTime: number;
  lastPriority: number;
  lastLineText?: string;
}

export const initialCooldownState: CooldownState = {
  lastReactionTime: 0,
  lastPriority: 0,
  lastLineText: undefined
};

export function getCooldownDuration(priority: number): number {
  if (priority >= 9) return 0;       // checkmate/match results bypass cooldown
  if (priority >= 7) return 2500;    // check, promotion
  if (priority >= 4) return 4500;    // capture, castle, blunder
  return 6000;                       // normal, good move, endgame pressure
}

export function isCooldownActive(
  lastReactionTime: number,
  lastPriority: number,
  now: number
): boolean {
  const duration = getCooldownDuration(lastPriority);
  return now - lastReactionTime < duration;
}
