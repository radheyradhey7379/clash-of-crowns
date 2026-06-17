import { describe, it, expect, vi } from 'vitest';
import { CommentaryContext, CommentaryTrigger } from '../commentaryTypes';
import { detectMoveReaction, getMovePriority, shouldReactToMove } from '../moveReactionEngine';
import { getTonesForContext, selectCommentaryLine } from '../commentarySelector';
import { getCooldownDuration, isCooldownActive } from '../commentaryCooldown';

describe('Commentary Move Reaction Engine Tests', () => {

  it('should map checkmate to highest priority', () => {
    const matePriority = getMovePriority('checkmate');
    const normalPriority = getMovePriority('normal_move');
    const checkPriority = getMovePriority('check');
    expect(matePriority).toBe(10);
    expect(matePriority).toBeGreaterThan(checkPriority);
    expect(checkPriority).toBeGreaterThan(normalPriority);
  });

  it('should support side-aware eval improvement for White and Black', () => {
    // White player makes a good move
    const contextWhiteGood: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 10,
      lastEval: 10,
      currEval: 25, // White eval increased by 15
    };
    const triggersWhiteGood = detectMoveReaction(contextWhiteGood);
    expect(triggersWhiteGood).toContain('good_move');

    // Black player makes a good move
    const contextBlackGood: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'b',
      currentTurn: 'w',
      moveNumber: 10,
      lastEval: 25,
      currEval: 10, // Black eval improved (White eval decreased from 25 to 10)
    };
    const triggersBlackGood = detectMoveReaction(contextBlackGood);
    expect(triggersBlackGood).toContain('good_move');

    // White player blunders
    const contextWhiteBlunder: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 10,
      lastEval: 20,
      currEval: 0, // White eval dropped by 20
    };
    const triggersWhiteBlunder = detectMoveReaction(contextWhiteBlunder);
    expect(triggersWhiteBlunder).toContain('blunder_warning');

    // Black player blunders
    const contextBlackBlunder: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'b',
      currentTurn: 'w',
      moveNumber: 10,
      lastEval: 0,
      currEval: 20, // Black eval worsened (White eval increased from 0 to 20)
    };
    const triggersBlackBlunder = detectMoveReaction(contextBlackBlunder);
    expect(triggersBlackBlunder).toContain('blunder_warning');
  });

  it('should skip good_move and blunder_warning when eval is missing and not crash', () => {
    const contextNoEval: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 10
    };
    const triggers = detectMoveReaction(contextNoEval);
    expect(triggers).not.toContain('good_move');
    expect(triggers).not.toContain('blunder_warning');
    expect(triggers).toContain('normal_move');
  });

  it('should support neutral tone and map correctly for Friend matches', () => {
    const friendContext: CommentaryContext = {
      roomMode: 'friend',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5
    };
    const tones = getTonesForContext(friendContext);
    expect(tones).toEqual(['neutral']);
  });

  it('should block normal move spam but allow it under normal_move randomness (test-safe)', () => {
    const context: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5
    };

    // With random value > 0.20, normal move should be blocked
    const shouldReactFail = shouldReactToMove(context, 0, 0, 10000, () => 0.5);
    expect(shouldReactFail).toBe(false);

    // With random value <= 0.20, normal move should be accepted
    const shouldReactPass = shouldReactToMove(context, 0, 0, 10000, () => 0.1);
    expect(shouldReactPass).toBe(true);
  });

  it('should apply priority-based cooldowns and allow checkmate to bypass cooldown', () => {
    const contextNormal: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5
    };

    // Cooldown check for low priority (e.g. normal move, priority 1) -> 6000ms
    const activeLow = isCooldownActive(1000, 1, 3000); // 2000ms elapsed < 6000ms
    expect(activeLow).toBe(true);

    const activeLowPass = isCooldownActive(1000, 1, 8000); // 7000ms elapsed > 6000ms
    expect(activeLowPass).toBe(false);

    // High priority checkmate context
    const mateContext: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5,
      isCheckmate: true
    };

    // Checkmate bypasses cooldown check entirely inside shouldReactToMove
    const shouldReactMate = shouldReactToMove(mateContext, 1000, 8, 2000); // 1000ms elapsed, but isCheckmate is true
    expect(shouldReactMate).toBe(true);
  });

  it('should prevent repeating the exact same line twice in a row', () => {
    const context: CommentaryContext = {
      roomMode: 'comp',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5,
      tierId: 'core',
      isCheck: true
    };

    const triggers: CommentaryTrigger[] = ['check'];
    const reaction1 = selectCommentaryLine(context, triggers);
    expect(reaction1).not.toBeNull();

    // Select again using the first line as lastLineText
    const reaction2 = selectCommentaryLine(context, triggers, reaction1!.text);
    if (reaction2) {
      expect(reaction2.text).not.toBe(reaction1!.text);
    }
  });

  it('should filter out normal moves and spam from Friend Match selector', () => {
    const context: CommentaryContext = {
      roomMode: 'friend',
      playerColor: 'w',
      currentTurn: 'b',
      moveNumber: 5
    };

    // normal_move triggers in friend match should return null as they are event-neutral only
    const reaction = selectCommentaryLine(context, ['normal_move']);
    expect(reaction).toBeNull();

    // capture event trigger should return a valid neutral reaction
    const reactionCapture = selectCommentaryLine(context, ['capture']);
    expect(reactionCapture).not.toBeNull();
    expect(reactionCapture!.tone).toBe('neutral');
  });

});
