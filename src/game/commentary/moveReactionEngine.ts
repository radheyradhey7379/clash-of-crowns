import { CommentaryContext, CommentaryTrigger } from './commentaryTypes';

export function detectMoveReaction(context: CommentaryContext): CommentaryTrigger[] {
  const triggers: CommentaryTrigger[] = [];

  if (context.isCheckmate) {
    triggers.push('checkmate');
    return triggers;
  }
  if (context.isCheck) {
    triggers.push('check');
  }
  if (context.isPromotion) {
    triggers.push('promotion');
  }
  if (context.isCapture) {
    triggers.push('capture');
  }
  if (context.isCastle) {
    triggers.push('castle');
  }

  // Side-aware eval check (Correction 2)
  if (context.currEval !== undefined && context.lastEval !== undefined) {
    const isWhite = context.playerColor === 'w';
    const improvement = isWhite 
      ? context.currEval - context.lastEval 
      : context.lastEval - context.currEval;

    if (improvement > 10) {
      triggers.push('good_move');
    } else if (improvement < -15) {
      triggers.push('blunder_warning');
    }
  }

  // Endgame pressure detection
  const isEndgame = context.isEndgame || 
    (context.totalPieces !== undefined && context.totalPieces <= 12) ||
    context.moveNumber >= 40;
    
  if (isEndgame && triggers.length === 0) {
    triggers.push('endgame_pressure');
  }

  // If no triggers are registered, default to normal_move
  if (triggers.length === 0) {
    triggers.push('normal_move');
  }

  return triggers;
}

export function getMovePriority(trigger: CommentaryTrigger): number {
  switch (trigger) {
    case 'checkmate':
    case 'match_win':
    case 'match_loss':
    case 'match_draw':
      return 10;
    case 'check':
      return 8;
    case 'promotion':
      return 7;
    case 'capture':
      return 6;
    case 'castle':
      return 5;
    case 'blunder_warning':
      return 4;
    case 'good_move':
      return 3;
    case 'endgame_pressure':
      return 2;
    case 'normal_move':
    default:
      return 1;
  }
}

export function shouldReactToMove(
  context: CommentaryContext,
  lastReactionTime: number,
  lastPriority: number,
  now: number,
  randomFn?: () => number
): boolean {
  // Checkmate / Match end events bypass all cooldowns
  if (context.isCheckmate) {
    return true;
  }

  // Calculate required cooldown based on the LAST shown reaction's priority
  let requiredCooldown = 6000;
  if (lastPriority >= 9) {
    requiredCooldown = 0;
  } else if (lastPriority >= 7) {
    requiredCooldown = 2500;
  } else if (lastPriority >= 4) {
    requiredCooldown = 4500;
  }

  if (now - lastReactionTime < requiredCooldown) {
    return false;
  }

  // Skip normal move commentary for the very early game unless match_start
  const triggers = detectMoveReaction(context);
  const isOnlyNormal = triggers.length === 1 && triggers[0] === 'normal_move';

  if (isOnlyNormal) {
    if (context.moveNumber <= 3) {
      return false;
    }
    // Correction 5: normal move random chance is test-safe with injectable randomFn
    const rand = randomFn ? randomFn() : Math.random();
    if (rand > 0.20) {
      return false; // 20% chance to react to normal moves
    }
  }

  return true;
}
