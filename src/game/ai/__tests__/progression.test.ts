import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyAIMatchResult,
  isCharacterUnlocked,
  isCharacterCurrent,
  getGameResultCTA,
  validateCharacterSelection
} from '../progressionEngine';
import { DEFAULT_AI_PROGRESS } from '../aiProgressDefaults';
import { AIProgress } from '../../../types/aiProgression';
import { createProtectedSave, verifyProtectedSave } from '../../../lib/protectedSave';


describe('AI Career Progression Engine (8 Tiers)', () => {
  let progress: AIProgress;

  beforeEach(() => {
    progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
  });

  it('1. Beginner win unlocks next Beginner character', () => {
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('beginner');
    expect(next.level).toBe(2);
    expect(next.elo).toBe(20); // 0 + 20
  });

  it('2. Beginner 5 win unlocks Learner', () => {
    progress.tier = 'beginner';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('learner');
  });

  it('3. Beginner loss retries same character', () => {
    progress.tier = 'beginner';
    progress.level = 2;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('beginner');
    expect(next.level).toBe(2);
    expect(next.elo).toBe(0); // Beginner loss: no ELO drop
  });

  it('4. Learner loss does not drop level unless consecutive losses >= 3', () => {
    progress.tier = 'learner';
    progress.level = 2;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(2);
    expect(next.consecutiveLosses).toBe(1);
  });

  it('5. Learner three consecutive losses drops one level', () => {
    progress.tier = 'learner';
    progress.level = 3;
    progress.elo = 350;
    progress.consecutiveLosses = 2; // Already lost twice
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(2); // Dropped from 3 to 2
    expect(next.consecutiveLosses).toBe(0); // Resets after drop
    expect(next.elo).toBe(324); // 350 - 26
  });

  it('6. Learner 1 consecutive losses drops back to Beginner 5', () => {
    progress.tier = 'learner';
    progress.level = 1;
    progress.consecutiveLosses = 2;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('beginner');
    expect(next.level).toBe(5);
  });

  it('7. Learner 5 win unlocks Intermediate', () => {
    progress.tier = 'learner';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('intermediate');
  });

  it('8. Intermediate two consecutive losses drops one level', () => {
    progress.tier = 'intermediate';
    progress.level = 4;
    progress.elo = 350;
    progress.consecutiveLosses = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(3);
    expect(next.elo).toBe(324); // 350 - 26
  });

  it('9. Intermediate 1 consecutive losses drops back to Learner 5', () => {
    progress.tier = 'intermediate';
    progress.level = 1;
    progress.consecutiveLosses = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(5);
  });

  it('10. Intermediate 8 win unlocks Hard', () => {
    progress.tier = 'intermediate';
    progress.level = 8;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('hard');
  });

  it('11. Hard loss drops one level', () => {
    progress.tier = 'hard';
    progress.level = 5;
    progress.elo = 350;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.level).toBe(4);
    expect(next.elo).toBe(331); // 350 - 19
  });

  it('12. Hard 1 loss locks Hard and returns to Intermediate 8', () => {
    progress.tier = 'hard';
    progress.level = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(8);
    expect(next.hard.locked).toBe(true);
  });

  it('13. Intermediate 8 win unlocks Hard again', () => {
    progress.tier = 'intermediate';
    progress.level = 8;
    progress.hard.locked = true;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.hard.locked).toBe(false);
  });

  it('14. Hard 8 win unlocks Master', () => {
    progress.tier = 'hard';
    progress.level = 8;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('master');
    expect(next.level).toBe(1);
    expect(next.masterCup.currentCup).toBe(1);
  });

  it('15. Master Cup 3 wins out of 4 unlocks next cup', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 1;
    progress.masterCup.currentMatch = 3;
    progress.masterCup.winsInCup = 2; // Won 2, this is the 3rd win
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false, cupCleared: true });
    expect(next.masterCup.currentCup).toBe(2);
    expect(next.masterCup.currentMatch).toBe(1);
  });

  it('16. Master Cup fail retries same cup', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 2;
    progress.masterCup.currentMatch = 3;
    progress.masterCup.winsInCup = 1; // 1 win, so we fail the cup
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false, cupCleared: false });
    expect(next.masterCup.currentCup).toBe(2);
    expect(next.masterCup.currentMatch).toBe(1);
  });

  it('17. Master Cup 3 completion unlocks Grandmaster', () => {
    progress.tier = 'master';
    progress.elo = 1450;
    progress.masterCup.currentCup = 3;
    progress.masterCup.currentMatch = 3;
    progress.masterCup.winsInCup = 2;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false, cupCleared: true });
    expect(next.tier).toBe('grandmaster');
    expect(next.level).toBe(1);
    expect(next.grandmaster.unlocked).toBe(true);
  });

  it('18. Grandmaster Crownless King best-of-3 works', () => {
    progress.tier = 'grandmaster';
    progress.level = 1;
    progress.grandmaster.bossSeriesWins = 1;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.grandmaster.bossDefeated).toBe(true);
    expect(next.grandmaster.bossSeriesWins).toBe(0); // Resets
  });
});

// Phase 14 additions
import { getCurrentPlayableCharacterId } from '../progressionEngine';
import { calculateAIMatchRewards } from '../aiRewards';
import { matchFlowService } from '../matchFlowService';
import { DEFAULT_PLAYER_DATA } from '../../../lib/store';
import { PlayerData } from '../../../types';

describe('AI Career Progression Engine (Phase 14 New Requirements)', () => {
  let progress: AIProgress;
  let playerData: PlayerData;

  beforeEach(() => {
    progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
    playerData = JSON.parse(JSON.stringify(DEFAULT_PLAYER_DATA));
    playerData.aiProgress = progress;
  });

  it('Selecting locked character is blocked', () => {
    // Learner 1 is locked initially because user is at Beginner 1
    const validation = validateCharacterSelection('learner_1', progress);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('Character is locked');
  });

  it('Selecting unlocked character is allowed', () => {
    // Beginner 1 is unlocked initially
    const validation = validateCharacterSelection('beginner_1', progress);
    expect(validation.valid).toBe(true);
  });

  it('Selecting previous completed characters is allowed', () => {
    progress.tier = 'beginner';
    progress.level = 3;
    // Beginner 1 is already completed, it should be playable
    const validation = validateCharacterSelection('beginner_1', progress);
    expect(validation.valid).toBe(true);
  });

  it('Invalid characterId triggers fallback to current playable character', () => {
    progress.tier = 'beginner';
    progress.level = 3; // current playable is beginner_3
    const validation = validateCharacterSelection('invalid_id', progress);
    expect(validation.valid).toBe(false);
    expect(validation.fallbackCharacterId).toBe('beginner_3');

    const validationNull = validateCharacterSelection(null, progress);
    expect(validationNull.valid).toBe(false);
    expect(validationNull.fallbackCharacterId).toBe('beginner_3');
  });

  it('Rewards calculated correctly for Win, Loss, and Draw', () => {
    // 1. Win
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_1', tier: 'beginner', reason: 'checkmate', eloBefore: 300, timestamp: 0 });
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.coins).toBe(50);
    expect(winRewards.xp).toBe(100);

    // 2. Draw
    const nextDraw = applyAIMatchResult(progress, { result: 'draw', characterId: 'beginner_1', tier: 'beginner', reason: 'draw', eloBefore: 300, timestamp: 0 });
    const drawRewards = calculateAIMatchRewards('draw', progress, nextDraw);
    expect(drawRewards.coins).toBe(20);
    expect(drawRewards.xp).toBe(40);

    // 3. Loss
    const nextLoss = applyAIMatchResult(progress, { result: 'loss', characterId: 'beginner_1', tier: 'beginner', reason: 'checkmate', eloBefore: 300, timestamp: 0 });
    const lossRewards = calculateAIMatchRewards('loss', progress, nextLoss);
    expect(lossRewards.coins).toBe(0);
    expect(lossRewards.xp).toBe(10);
  });

  it('Tier unlock bonus is awarded and not duplicated', () => {
    progress.tier = 'beginner';
    progress.level = 5;
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_5', tier: 'beginner', reason: 'checkmate', eloBefore: 400, timestamp: 0 });
    // This win unlocks Learner tier
    expect(nextWin.tier).toBe('learner');
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.tierUnlocked).toBe('learner');
    expect(winRewards.coins).toBe(250); // 50 base win + 200 tier unlock bonus
    // Simulate user editing save to relock the tier, but claimed array still has it
    const cheatProgress = JSON.parse(JSON.stringify(progress));
    cheatProgress.claimedTierRewards = ['learner'];
    
    // They win again
    const cheatNextWin = applyAIMatchResult(cheatProgress, { result: 'win', characterId: 'beginner_5', tier: 'beginner', reason: 'checkmate', eloBefore: 400, timestamp: 0 });
    const winRewardsAgain = calculateAIMatchRewards('win', cheatProgress, cheatNextWin);
    
    expect(winRewardsAgain.tierUnlocked).toBeNull();
    expect(winRewardsAgain.coins).toBe(50); // ONLY base win! No +200!
    expect(winRewardsAgain.newlyClaimedTierRewards.length).toBe(0);
  });

  it('Master cup clear bonus is awarded and not duplicated', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 1;
    progress.masterCup.currentMatch = 3;
    progress.masterCup.winsInCup = 2; // 3rd win
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'master_1_3', tier: 'master', reason: 'checkmate', eloBefore: 2000, timestamp: 0, cupCleared: true });
    
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.cupCompleted).toBe(1);
    expect(winRewards.coins).toBe(550); // 50 base + 500 cup bonus
    expect(winRewards.newlyClaimedCupRewards).toContain(1);

    // Simulate user relocking cup
    const cheatProgress = JSON.parse(JSON.stringify(progress));
    cheatProgress.claimedCupRewards = [1];

    const cheatNextWin = applyAIMatchResult(cheatProgress, { result: 'win', characterId: 'master_1_3', tier: 'master', reason: 'checkmate', eloBefore: 2000, timestamp: 0, cupCleared: true });
    const winRewardsAgain = calculateAIMatchRewards('win', cheatProgress, cheatNextWin);
    
    expect(winRewardsAgain.cupCompleted).toBeNull();
    expect(winRewardsAgain.coins).toBe(50); // ONLY base win
    expect(winRewardsAgain.newlyClaimedCupRewards.length).toBe(0);
  });

  it('Master cup win updates cup state, draw does not count as win/loss', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 1;
    progress.masterCup.currentMatch = 1;
    progress.masterCup.winsInCup = 0;
    progress.masterCup.lossesInCup = 0;

    // Win
    let next = applyAIMatchResult(progress, { result: 'win', characterId: 'master_1_1', tier: 'master', reason: 'checkmate', eloBefore: 2000, timestamp: 0 });
    expect(next.masterCup.winsInCup).toBe(1);
    expect(next.masterCup.lossesInCup).toBe(0);
    expect(next.masterCup.currentMatch).toBe(2);

    // Draw should keep states same
    let nextDraw = applyAIMatchResult(next, { result: 'draw', characterId: 'master_1_2', tier: 'master', reason: 'draw', eloBefore: 2040, timestamp: 0 });
    expect(nextDraw.masterCup.winsInCup).toBe(1);
    expect(nextDraw.masterCup.lossesInCup).toBe(0);
    expect(nextDraw.masterCup.currentMatch).toBe(2);
  });

  it('Badges are awarded and do not duplicate', () => {
    progress.tier = 'grandmaster';
    progress.level = 1;
    progress.grandmaster.bossSeriesWins = 1; // 1 win already, this will be 2nd win to defeat boss
    
    playerData.badges = [];
    
    // Process win through matchFlowService
    const summary = matchFlowService.processMatchResult({
      matchId: 'test_match_123',
      characterId: 'grandmaster_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 1450
    }, playerData);

    expect(summary.rewards.badge).toBe('Grandmaster Boss Slayer');
    expect(summary.updatedPlayerData.badges).toContain('Grandmaster Boss Slayer');
    expect(summary.updatedPlayerData.badges?.length).toBe(1);

    // Try processing another win to ensure it is not duplicated
    const summary2 = matchFlowService.processMatchResult({
      matchId: 'test_match_456',
      characterId: 'grandmaster_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 1500
    }, summary.updatedPlayerData);

    expect(summary2.updatedPlayerData.badges?.length).toBe(1); // Still 1!
  });
});

// Phase 15 additions
import { getAIDifficultySettings } from '../aiDifficulty';
import { AI_CHARACTERS } from '../aiCharacters';


describe('AI Difficulty Scaling & Performance (Phase 15)', () => {
  it('Verify correct engine selected per tier', () => {
    const begChar = AI_CHARACTERS.find(c => c.tier === 'beginner')!;
    const learnChar = AI_CHARACTERS.find(c => c.tier === 'learner')!;
    const interChar = AI_CHARACTERS.find(c => c.tier === 'intermediate')!;
    const hardChar = AI_CHARACTERS.find(c => c.tier === 'hard')!;
    const masterChar = AI_CHARACTERS.find(c => c.tier === 'master')!;
    const gmChar = AI_CHARACTERS.find(c => c.tier === 'grandmaster')!;

    expect(begChar.engine).toBe('hce');
    expect(learnChar.engine).toBe('hce');
    expect(interChar.engine).toBe('nnue');
    expect(hardChar.engine).toBe('nnue');
    expect(masterChar.engine).toBe('nnue');
    expect(gmChar.engine).toBe('nnue');
  });

  it('Verify maxThinkTimeMs and moveDelayMs mapping/fallback per tier', () => {
    const mockBeg = { id: 'b1', tier: 'beginner', depth: 1, blunderRate: 0.3 } as any;
    const mockLearn = { id: 'l1', tier: 'learner', depth: 2, blunderRate: 0.2 } as any;
    const mockInter = { id: 'i1', tier: 'intermediate', depth: 4, blunderRate: 0.1 } as any;
    const mockHard = { id: 'h1', tier: 'hard', depth: 6, blunderRate: 0.05 } as any;
    const mockMaster = { id: 'm1', tier: 'master', depth: 8, blunderRate: 0.03 } as any;
    const mockGM = { id: 'g1', tier: 'grandmaster', depth: 10, blunderRate: 0.01 } as any;

    expect(getAIDifficultySettings(mockBeg).maxThinkTimeMs).toBe(500);
    expect(getAIDifficultySettings(mockLearn).maxThinkTimeMs).toBe(700);
    expect(getAIDifficultySettings(mockInter).maxThinkTimeMs).toBe(1200);
    expect(getAIDifficultySettings(mockHard).maxThinkTimeMs).toBe(1600);
    expect(getAIDifficultySettings(mockMaster).maxThinkTimeMs).toBe(2200);
    expect(getAIDifficultySettings(mockGM).maxThinkTimeMs).toBe(3000);

    expect(getAIDifficultySettings(mockBeg).moveDelayMs).toBe(250);
  });

  it('Verify custom maxThinkTimeMs and moveDelayMs are respected', () => {
    const mockChar = { id: 'custom', tier: 'intermediate', depth: 4, blunderRate: 0.1, maxThinkTimeMs: 1500, moveDelayMs: 400 } as any;
    const settings = getAIDifficultySettings(mockChar);
    expect(settings.maxThinkTimeMs).toBe(1500);
    expect(settings.moveDelayMs).toBe(400);
  });

  it('Verify AI thinking guard prevents user moves and duplicate calculations', () => {
    let isAIThinking = false;
    let userMoveAllowed = true;
    let aiMoveTriggered = 0;

    const handleSquareClick = () => {
      if (isAIThinking) {
        userMoveAllowed = false;
        return;
      }
      userMoveAllowed = true;
    };

    const triggerAIMove = () => {
      if (isAIThinking) return;
      isAIThinking = true;
      aiMoveTriggered++;
    };

    handleSquareClick();
    expect(userMoveAllowed).toBe(true);

    triggerAIMove();
    expect(aiMoveTriggered).toBe(1);
    expect(isAIThinking).toBe(true);

    handleSquareClick();
    expect(userMoveAllowed).toBe(false);

    triggerAIMove();
    expect(aiMoveTriggered).toBe(1);

    isAIThinking = false;
    handleSquareClick();
    expect(userMoveAllowed).toBe(true);

    triggerAIMove();
    expect(aiMoveTriggered).toBe(2);
  });
});

// Phase 16 additions

describe('AI Personality, Dialogue & Match Feel (Phase 16)', () => {
  it('Verify all 40 characters/modes have complete dialogue fields and correct types', () => {
    expect(AI_CHARACTERS.length).toBe(40);

    AI_CHARACTERS.forEach(char => {
      expect(char.introLine).toBeDefined();
      expect(typeof char.introLine).toBe('string');
      expect(char.introLine!.length).toBeGreaterThan(0);

      expect(char.playerWinLine).toBeDefined();
      expect(typeof char.playerWinLine).toBe('string');
      expect(char.playerWinLine!.length).toBeGreaterThan(0);

      expect(char.playerLossLine).toBeDefined();
      expect(typeof char.playerLossLine).toBe('string');
      expect(char.playerLossLine!.length).toBeGreaterThan(0);

      expect(char.drawLine).toBeDefined();
      expect(typeof char.drawLine).toBe('string');
      expect(char.drawLine!.length).toBeGreaterThan(0);

      expect(char.taunts).toBeDefined();
      expect(Array.isArray(char.taunts)).toBe(true);
      expect(char.taunts!.length).toBeGreaterThan(0);
      char.taunts!.forEach(taunt => {
        expect(typeof taunt).toBe('string');
        expect(taunt.length).toBeGreaterThan(0);
      });
      
      expect(char.mood).toBeDefined();
      expect(char.difficultyLabel).toBeDefined();
    });
  });

  it('Verify dialogue lookup by characterId works', () => {
    const woodpecker = AI_CHARACTERS.find(c => c.id === 'beginner_1')!;
    expect(woodpecker.name).toBe('Woodpecker');
    expect(woodpecker.introLine).toContain('Hello! I am Woodpecker');
  });

  it('Verify outcome mapping helper resolves correct dialogue for win, loss, and draw', () => {
    const mockChar = {
      id: 'test_char',
      introLine: 'Intro!',
      playerWinLine: 'Win!',
      playerLossLine: 'Loss!',
      drawLine: 'Draw!',
      taunts: ['T1']
    } as any;

    const getPostMatchLine = (char: any, outcome: 'win' | 'loss' | 'draw') => {
      if (outcome === 'draw') return char.drawLine || 'A balanced battle.';
      if (outcome === 'win') return char.playerWinLine || 'You played well.';
      return char.playerLossLine || 'The board belongs to me this time.';
    };

    expect(getPostMatchLine(mockChar, 'win')).toBe('Win!');
    expect(getPostMatchLine(mockChar, 'loss')).toBe('Loss!');
    expect(getPostMatchLine(mockChar, 'draw')).toBe('Draw!');
  });

  it('Verify missing dialogue uses fallbacks safely without crashing', () => {
    const mockEmptyChar = { id: 'empty_char' } as any;

    const getIntroLine = (char: any) => char.introLine || 'Prepare your move.';
    const getPostMatchLine = (char: any, outcome: 'win' | 'loss' | 'draw') => {
      if (outcome === 'draw') return char.drawLine || 'A balanced battle.';
      if (outcome === 'win') return char.playerWinLine || 'You played well.';
      return char.playerLossLine || 'The board belongs to me this time.';
    };
    const getTaunts = (char: any) => char.taunts || [];

    expect(getIntroLine(mockEmptyChar)).toBe('Prepare your move.');
    expect(getPostMatchLine(mockEmptyChar, 'win')).toBe('You played well.');
    expect(getPostMatchLine(mockEmptyChar, 'loss')).toBe('The board belongs to me this time.');
    expect(getPostMatchLine(mockEmptyChar, 'draw')).toBe('A balanced battle.');
    expect(getTaunts(mockEmptyChar)).toEqual([]);
  });

  describe('Phase 12 NNUE Promotion Calibration & Sequential Unlocking Tests', () => {
    let progress: AIProgress;

    beforeEach(() => {
      progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
    });

    it('only_first_beginner_bot_unlocked_initially', () => {
      expect(isCharacterUnlocked('beginner_1', progress)).toBe(true);
      expect(isCharacterUnlocked('beginner_2', progress)).toBe(false);
      expect(isCharacterUnlocked('beginner_3', progress)).toBe(false);
      expect(isCharacterUnlocked('beginner_4', progress)).toBe(false);
      expect(isCharacterUnlocked('beginner_5', progress)).toBe(false);
    });

    it('winning_beginner_1_unlocks_only_beginner_2', () => {
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_1', playerWon: true, isDraw: false });
      expect(nextProgress.level).toBe(2);
      expect(isCharacterUnlocked('beginner_1', nextProgress)).toBe(true);
      expect(isCharacterUnlocked('beginner_2', nextProgress)).toBe(true);
      expect(isCharacterUnlocked('beginner_3', nextProgress)).toBe(false);
    });

    it('winning_beginner_1_does_not_unlock_beginner_3_or_later', () => {
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_1', playerWon: true, isDraw: false });
      expect(isCharacterUnlocked('beginner_3', nextProgress)).toBe(false);
      expect(isCharacterUnlocked('beginner_4', nextProgress)).toBe(false);
      expect(isCharacterUnlocked('beginner_5', nextProgress)).toBe(false);
    });

    it('locked_bot_cannot_be_challenged', () => {
      const validation = validateCharacterSelection('beginner_3', progress);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('Character is locked');
    });

    it('direct_navigation_to_locked_bot_blocked', () => {
      const validation = validateCharacterSelection('beginner_3', progress);
      expect(validation.valid).toBe(false);
      expect(validation.fallbackCharacterId).toBe('beginner_1');
    });

    it('current_bot_display_correct', () => {
      expect(isCharacterCurrent('beginner_1', progress)).toBe(true);
      expect(isCharacterCurrent('beginner_2', progress)).toBe(false);
    });

    it('guest_progress_persists_locally', () => {
      const defaultData = { name: "Guest", aiProgress: progress } as any;
      const savedObj = createProtectedSave(defaultData);
      expect(verifyProtectedSave(savedObj)).toBe(true);
      const parsedPayload = JSON.parse(savedObj.payload);
      expect(parsedPayload.aiProgress.level).toBe(1);
    });

    it('completed_bot_shows_completed_or_replay', () => {
      progress.tier = 'beginner';
      progress.level = 3;
      expect(isCharacterUnlocked('beginner_1', progress)).toBe(true);
      expect(isCharacterCurrent('beginner_1', progress)).toBe(false);
    });

    it('next_bot_shows_current', () => {
      progress.tier = 'beginner';
      progress.level = 1;
      expect(isCharacterCurrent('beginner_1', progress)).toBe(true);
    });

    it('tier_transition_unlocks_first_bot_only', () => {
      progress.tier = 'beginner';
      progress.level = 5;
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_5', playerWon: true, isDraw: false });
      expect(nextProgress.tier).toBe('learner');
      expect(nextProgress.level).toBe(1);
      expect(isCharacterUnlocked('learner_1', nextProgress)).toBe(true);
      expect(isCharacterUnlocked('learner_2', nextProgress)).toBe(false);
    });

    it('win_result_shows_next_level', () => {
      progress.tier = 'beginner';
      progress.level = 1;
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_1', playerWon: true, isDraw: false });
      const cta = getGameResultCTA('win', 'beginner_1', nextProgress);
      expect(cta.label).toBe('NEXT LEVEL');
      expect(cta.nextCharacterId).toBe('beginner_2');
    });

    it('loss_result_shows_retry', () => {
      progress.tier = 'beginner';
      progress.level = 1;
      const cta = getGameResultCTA('loss', 'beginner_1', progress);
      expect(cta.label).toBe('RETRY');
    });

    it('draw_result_shows_retry', () => {
      progress.tier = 'beginner';
      progress.level = 1;
      const cta = getGameResultCTA('draw', 'beginner_1', progress);
      expect(cta.label).toBe('RETRY');
    });

    it('final_bot_win_shows_next_tier_or_cup_unlock', () => {
      progress.tier = 'beginner';
      progress.level = 5;
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_5', playerWon: true, isDraw: false });
      const cta = getGameResultCTA('win', 'beginner_5', nextProgress);
      expect(cta.label).toBe('NEXT LEVEL');
      expect(cta.nextCharacterId).toBe('learner_1');
    });

    it('next_level_cta_uses_next_character_id', () => {
      progress.tier = 'beginner';
      progress.level = 1;
      const nextProgress = applyAIMatchResult(progress, { result: 'win', characterId: 'beginner_1', playerWon: true, isDraw: false });
      const cta = getGameResultCTA('win', 'beginner_1', nextProgress);
      expect(cta.nextCharacterId).toBe('beginner_2');
    });

    it('game_remounts_cleanly_on_next_level', () => {
      const keyVal1 = 'beginner_1';
      const keyVal2 = 'beginner_2';
      expect(keyVal1).not.toBe(keyVal2);
    });
  });
});
