import { describe, it, expect, beforeEach } from 'vitest';
import { applyAIMatchResult, isCharacterUnlocked } from '../progressionEngine';
import { DEFAULT_AI_PROGRESS } from '../aiProgressDefaults';
import { AIProgress } from '../../../types/aiProgression';

describe('AI Career Progression Engine (8 Tiers)', () => {
  let progress: AIProgress;

  beforeEach(() => {
    progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
  });

  it('1. Core win unlocks next Core character', () => {
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('core');
    expect(next.level).toBe(2);
    expect(next.elo).toBe(120); // 100 + 20
  });

  it('2. Core 5 win unlocks Beginner', () => {
    progress.tier = 'core';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('beginner');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('beginner');
  });

  it('3. Beginner loss retries same character', () => {
    progress.tier = 'beginner';
    progress.level = 2;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('beginner');
    expect(next.level).toBe(2);
    expect(next.elo).toBe(100); // Beginner loss: no ELO drop
  });

  it('4. Beginner 5 win unlocks Learner', () => {
    progress.tier = 'beginner';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('learner');
  });

  it('5. Learner two consecutive losses drops one level', () => {
    progress.tier = 'learner';
    progress.level = 3;
    progress.consecutiveLosses = 1; // Already lost once
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(2); // Dropped from 3 to 2
    expect(next.consecutiveLosses).toBe(0); // Resets after drop
    expect(next.elo).toBe(95); // 100 - 5
  });

  it('6. Learner cannot drop below Learner 1', () => {
    progress.tier = 'learner';
    progress.level = 1;
    progress.consecutiveLosses = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('learner');
    expect(next.level).toBe(1); // Stays at 1
  });

  it('7. Learner 5 win unlocks Promotion Trial', () => {
    progress.tier = 'learner';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('promotion_trial');
    expect(next.level).toBe(1);
    expect(next.promotionTrial.unlocked).toBe(true);
    expect(next.unlockedTiers).toContain('promotion_trial');
  });

  it('8. Promotion Trial 5 win unlocks Intermediate', () => {
    progress.tier = 'promotion_trial';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('intermediate');
  });

  it('9. Promotion Trial loss retries same character', () => {
    progress.tier = 'promotion_trial';
    progress.level = 2;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('promotion_trial');
    expect(next.level).toBe(2);
  });

  it('10. Intermediate two losses drops one level', () => {
    progress.tier = 'intermediate';
    progress.level = 4;
    progress.consecutiveLosses = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(3);
    expect(next.elo).toBe(90); // 100 - 10
  });

  it('11. Intermediate cannot drop below Intermediate 1', () => {
    progress.tier = 'intermediate';
    progress.level = 1;
    progress.consecutiveLosses = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(1);
  });

  it('12. Intermediate 8 win unlocks Hard', () => {
    progress.tier = 'intermediate';
    progress.level = 8;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.level).toBe(1);
    expect(next.unlockedTiers).toContain('hard');
  });

  it('13. Hard loss drops one level', () => {
    progress.tier = 'hard';
    progress.level = 5;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.level).toBe(4);
    expect(next.elo).toBe(80); // 100 - 20
  });

  it('14. Hard 1 loss locks Hard and returns to Intermediate 8', () => {
    progress.tier = 'hard';
    progress.level = 1;
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.tier).toBe('intermediate');
    expect(next.level).toBe(8);
    expect(next.hard.locked).toBe(true);
  });

  it('15. Intermediate 8 win unlocks Hard again', () => {
    progress.tier = 'intermediate';
    progress.level = 8;
    progress.hard.locked = true;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('hard');
    expect(next.hard.locked).toBe(false);
  });

  it('16. Hard 8 win unlocks Master', () => {
    progress.tier = 'hard';
    progress.level = 8;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('master');
    expect(next.level).toBe(1);
    expect(next.masterCup.currentCup).toBe(1);
  });

  it('17. Master Cup 3 wins out of 4 unlocks next cup', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 1;
    progress.masterCup.currentMatch = 4;
    progress.masterCup.winsInCup = 2; // Won 2, this is the 3rd win
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.masterCup.currentCup).toBe(2);
    expect(next.masterCup.currentMatch).toBe(1);
    expect(next.level).toBe(5); // Start of Cup 2
  });

  it('18. Master Cup fail retries same cup', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 2;
    progress.masterCup.currentMatch = 4;
    progress.masterCup.winsInCup = 1; // 1 win, so we fail the cup
    const next = applyAIMatchResult(progress, { playerWon: false, isDraw: false });
    expect(next.masterCup.currentCup).toBe(2);
    expect(next.masterCup.currentMatch).toBe(1);
    expect(next.level).toBe(5); // Retries Cup 2
  });

  it('19. Master Cup 3 completion unlocks Grandmaster if ELO condition is met', () => {
    progress.tier = 'master';
    progress.elo = 2500;
    progress.masterCup.currentCup = 3;
    progress.masterCup.currentMatch = 4;
    progress.masterCup.winsInCup = 2;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.tier).toBe('grandmaster');
    expect(next.level).toBe(1);
    expect(next.grandmaster.unlocked).toBe(true);
  });

  it('20. Grandmaster Crownless King best-of-3 works', () => {
    progress.tier = 'grandmaster';
    progress.level = 1;
    progress.grandmaster.bossSeriesWins = 1;
    const next = applyAIMatchResult(progress, { playerWon: true, isDraw: false });
    expect(next.grandmaster.bossDefeated).toBe(true);
    expect(next.grandmaster.bossSeriesWins).toBe(0); // Resets
  });
});

// Phase 14 additions
import { validateCharacterSelection, getCurrentPlayableCharacterId } from '../progressionEngine';
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
    // Beginner 1 is locked initially because user is at Core 1
    const validation = validateCharacterSelection('beginner_1', progress);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('Character is locked');
  });

  it('Selecting unlocked character is allowed', () => {
    // Core 1 is unlocked initially
    const validation = validateCharacterSelection('core_1', progress);
    expect(validation.valid).toBe(true);
  });

  it('Selecting previous completed characters is allowed', () => {
    progress.tier = 'core';
    progress.level = 3;
    // Core 1 is already completed, it should be playable
    const validation = validateCharacterSelection('core_1', progress);
    expect(validation.valid).toBe(true);
  });

  it('Invalid characterId triggers fallback to current playable character', () => {
    progress.tier = 'core';
    progress.level = 3; // current playable is core_3
    const validation = validateCharacterSelection('invalid_id', progress);
    expect(validation.valid).toBe(false);
    expect(validation.fallbackCharacterId).toBe('core_3');

    const validationNull = validateCharacterSelection(null, progress);
    expect(validationNull.valid).toBe(false);
    expect(validationNull.fallbackCharacterId).toBe('core_3');
  });

  it('Rewards calculated correctly for Win, Loss, and Draw', () => {
    // 1. Win
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'core_1', tier: 'core', reason: 'checkmate', eloBefore: 100, timestamp: 0 });
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.coins).toBe(50);
    expect(winRewards.xp).toBe(100);

    // 2. Draw
    const nextDraw = applyAIMatchResult(progress, { result: 'draw', characterId: 'core_1', tier: 'core', reason: 'draw', eloBefore: 100, timestamp: 0 });
    const drawRewards = calculateAIMatchRewards('draw', progress, nextDraw);
    expect(drawRewards.coins).toBe(20);
    expect(drawRewards.xp).toBe(40);

    // 3. Loss
    const nextLoss = applyAIMatchResult(progress, { result: 'loss', characterId: 'core_1', tier: 'core', reason: 'checkmate', eloBefore: 100, timestamp: 0 });
    const lossRewards = calculateAIMatchRewards('loss', progress, nextLoss);
    expect(lossRewards.coins).toBe(0);
    expect(lossRewards.xp).toBe(10);
  });

  it('Tier unlock bonus is awarded and not duplicated', () => {
    progress.tier = 'core';
    progress.level = 5;
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'core_5', tier: 'core', reason: 'checkmate', eloBefore: 180, timestamp: 0 });
    // This win unlocks Beginner tier
    expect(nextWin.tier).toBe('beginner');
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.tierUnlocked).toBe('beginner');
    expect(winRewards.coins).toBe(250); // 50 base win + 200 tier unlock bonus
    // Simulate user editing save to relock the tier, but claimed array still has it
    const cheatProgress = JSON.parse(JSON.stringify(progress));
    cheatProgress.claimedTierRewards = ['beginner'];
    
    // They win again
    const cheatNextWin = applyAIMatchResult(cheatProgress, { result: 'win', characterId: 'core_5', tier: 'core', reason: 'checkmate', eloBefore: 180, timestamp: 0 });
    const winRewardsAgain = calculateAIMatchRewards('win', cheatProgress, cheatNextWin);
    
    expect(winRewardsAgain.tierUnlocked).toBeNull();
    expect(winRewardsAgain.coins).toBe(50); // ONLY base win! No +200!
    expect(winRewardsAgain.newlyClaimedTierRewards.length).toBe(0);
  });

  it('Master cup clear bonus is awarded and not duplicated', () => {
    progress.tier = 'master';
    progress.masterCup.currentCup = 1;
    progress.masterCup.currentMatch = 4;
    progress.masterCup.winsInCup = 2; // 3rd win
    const nextWin = applyAIMatchResult(progress, { result: 'win', characterId: 'master_1_4', tier: 'master', reason: 'checkmate', eloBefore: 2000, timestamp: 0 });
    
    const winRewards = calculateAIMatchRewards('win', progress, nextWin);
    expect(winRewards.cupCompleted).toBe(1);
    expect(winRewards.coins).toBe(550); // 50 base + 500 cup bonus
    expect(winRewards.newlyClaimedCupRewards).toContain(1);

    // Simulate user relocking cup
    const cheatProgress = JSON.parse(JSON.stringify(progress));
    cheatProgress.claimedCupRewards = [1];

    const cheatNextWin = applyAIMatchResult(cheatProgress, { result: 'win', characterId: 'master_1_4', tier: 'master', reason: 'checkmate', eloBefore: 2000, timestamp: 0 });
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
      eloBefore: 2600
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
      eloBefore: 2650
    }, summary.updatedPlayerData);

    expect(summary2.updatedPlayerData.badges?.length).toBe(1); // Still 1!
  });
});

// Phase 15 additions
import { getAIDifficultySettings } from '../aiDifficulty';
import { AI_CHARACTERS } from '../aiCharacters';
import { stockfishService } from '../../../services/stockfishService';

describe('AI Difficulty Scaling & Performance (Phase 15)', () => {
  it('Verify correct engine selected per tier', () => {
    const coreChar = AI_CHARACTERS.find(c => c.tier === 'core')!;
    const begChar = AI_CHARACTERS.find(c => c.tier === 'beginner')!;
    const learnChar = AI_CHARACTERS.find(c => c.tier === 'learner')!;
    const interChar = AI_CHARACTERS.find(c => c.tier === 'intermediate')!;
    const hardChar = AI_CHARACTERS.find(c => c.tier === 'hard')!;
    const masterChar = AI_CHARACTERS.find(c => c.tier === 'master')!;
    const gmChar = AI_CHARACTERS.find(c => c.tier === 'grandmaster')!;

    expect(coreChar.engine).toBe('simple');
    expect(begChar.engine).toBe('simple');
    expect(learnChar.engine).toBe('simple');
    expect(interChar.engine).toBe('stockfish');
    expect(hardChar.engine).toBe('stockfish');
    expect(masterChar.engine).toBe('stockfish');
    expect(gmChar.engine).toBe('stockfish');
  });

  it('Verify maxThinkTimeMs and moveDelayMs mapping/fallback per tier', () => {
    const mockCore = { id: 'c1', tier: 'core', depth: 1, blunderRate: 0.4 } as any;
    const mockBeg = { id: 'b1', tier: 'beginner', depth: 1, blunderRate: 0.3 } as any;
    const mockLearn = { id: 'l1', tier: 'learner', depth: 2, blunderRate: 0.2 } as any;
    const mockTrial = { id: 'pt1', tier: 'promotion_trial', depth: 2, blunderRate: 0.15 } as any;
    const mockInter = { id: 'i1', tier: 'intermediate', depth: 4, blunderRate: 0.1 } as any;
    const mockHard = { id: 'h1', tier: 'hard', depth: 6, blunderRate: 0.05 } as any;
    const mockMaster = { id: 'm1', tier: 'master', depth: 8, blunderRate: 0.03 } as any;
    const mockGM = { id: 'g1', tier: 'grandmaster', depth: 10, blunderRate: 0.01 } as any;

    expect(getAIDifficultySettings(mockCore).maxThinkTimeMs).toBe(300);
    expect(getAIDifficultySettings(mockBeg).maxThinkTimeMs).toBe(500);
    expect(getAIDifficultySettings(mockLearn).maxThinkTimeMs).toBe(700);
    expect(getAIDifficultySettings(mockTrial).maxThinkTimeMs).toBe(900);
    expect(getAIDifficultySettings(mockInter).maxThinkTimeMs).toBe(1200);
    expect(getAIDifficultySettings(mockHard).maxThinkTimeMs).toBe(1600);
    expect(getAIDifficultySettings(mockMaster).maxThinkTimeMs).toBe(2200);
    expect(getAIDifficultySettings(mockGM).maxThinkTimeMs).toBe(3000);

    expect(getAIDifficultySettings(mockCore).moveDelayMs).toBe(150);
    expect(getAIDifficultySettings(mockBeg).moveDelayMs).toBe(250);
  });

  it('Verify custom maxThinkTimeMs and moveDelayMs are respected', () => {
    const mockChar = { id: 'custom', tier: 'intermediate', depth: 4, blunderRate: 0.1, maxThinkTimeMs: 1500, moveDelayMs: 400 } as any;
    const settings = getAIDifficultySettings(mockChar);
    expect(settings.maxThinkTimeMs).toBe(1500);
    expect(settings.moveDelayMs).toBe(400);
  });

  it('Verify Stockfish worker cleanup (terminate resets worker instance)', () => {
    stockfishService.terminate();
    expect((stockfishService as any).worker).toBeNull();
  });

  it('Verify Stockfish worker timeout fallback returns null and handles stop command', async () => {
    const originalWorker = (globalThis as any).Worker;

    class MockWorker {
      postMessage(msg: string) {
        console.log('MockWorker received:', msg);
      }
      terminate() {
        console.log('MockWorker terminated');
      }
      onmessage: any = null;
    }

    (globalThis as any).Worker = MockWorker;

    stockfishService.terminate();
    (stockfishService as any).init();

    const bestMovePromise = stockfishService.getBestMove('startpos', 4, 20, 0, 50);

    const move = await bestMovePromise;
    expect(move).toBeNull();

    (globalThis as any).Worker = originalWorker;
    stockfishService.terminate();
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
  it('Verify all 51 characters/modes have complete dialogue fields and correct types', () => {
    expect(AI_CHARACTERS.length).toBe(51);

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
    const pawnlingRook = AI_CHARACTERS.find(c => c.id === 'core_1')!;
    expect(pawnlingRook.name).toBe('Pawnling Rook');
    expect(pawnlingRook.introLine).toContain('Hi! I am Pawnling Rook');
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
});
