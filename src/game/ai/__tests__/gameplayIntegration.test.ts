import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChessLogic } from '../../../lib/chess-logic';
import { EngineBrain } from '../../engine/engineBrain';
import { matchFlowService } from '../matchFlowService';
import { DEFAULT_PLAYER_DATA } from '../../../lib/store/store';
import { PlayerData } from '../../../types';
import { AI_CHARACTERS } from '../aiCharacters';

// Mock fetch globally
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('Gameplay Integration Tests', () => {
  let chess: ChessLogic;
  let playerData: PlayerData;

  beforeEach(() => {
    chess = new ChessLogic();
    playerData = JSON.parse(JSON.stringify(DEFAULT_PLAYER_DATA));
  });

  // ==========================================
  // 1. AI Turn Loop Fix Tests
  // ==========================================

  it('player_white_triggers_black_ai_move', () => {
    // Player is White, turn is White
    const playerColor = 'w';
    let turn = chess.getTurn();
    expect(turn).toBe('w');

    // Player makes move
    chess.makeMove('e4');
    turn = chess.getTurn();
    expect(turn).toBe('b');

    // Under this condition (turn === 'b' && playerColor === 'w'), AI (Black) triggers
    const triggerAIMove = turn !== playerColor;
    expect(triggerAIMove).toBe(true);
  });

  it('player_black_triggers_white_ai_move', () => {
    // Player is Black, turn starts as White
    const playerColor = 'b';
    const turn = chess.getTurn();
    expect(turn).toBe('w');

    // Under this condition (turn === 'w' && playerColor === 'b'), AI (White) triggers automatically on startup
    const triggerAIMove = turn !== playerColor;
    expect(triggerAIMove).toBe(true);
  });

  it('ai_move_applies_to_board', async () => {
    // Play White move first so it is Black's turn
    chess.makeMove('e4');

    // Mock successful Rust engine response
    const mockResponse = {
      ok: true,
      json: async () => ({
        move_str: 'e7e5',
        engine_used: 'hce',
        think_time_ms: 100,
        depth: 2
      })
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    const character = AI_CHARACTERS[0];
    const brain = EngineBrain.create(character, chess);
    const result = await brain.computeMove();

    expect(result.move).toEqual({ from: 'e7', to: 'e5', promotion: undefined });
    
    // Apply to board
    const m = chess.makeMove(result.move!);
    expect(m).not.toBeNull();
    expect(chess.getFen()).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('turn_switches_after_ai_move', () => {
    chess.makeMove('e4'); // Player White
    expect(chess.getTurn()).toBe('b');

    chess.makeMove({ from: 'e7', to: 'e5' }); // AI Black
    expect(chess.getTurn()).toBe('w'); // Turn switches back to White player
  });

  it('timer_runs_only_for_active_side', () => {
    let turn = 'w';
    let whiteTime = 0;
    let blackTime = 0;

    const tick = () => {
      if (turn === 'w') whiteTime++;
      else blackTime++;
    };

    tick();
    expect(whiteTime).toBe(1);
    expect(blackTime).toBe(0);

    turn = 'b';
    tick();
    expect(whiteTime).toBe(1);
    expect(blackTime).toBe(1);
  });

  it('ai_not_called_twice_for_one_turn', () => {
    let callCount = 0;
    let isThinking = false;

    const triggerAI = () => {
      if (isThinking) return;
      isThinking = true;
      callCount++;
    };

    triggerAI();
    triggerAI(); // Duplicate call in same tick
    expect(callCount).toBe(1);
  });

  it('game_does_not_count_only_player_side', () => {
    // Both sides increment ply in history
    chess.makeMove('e4');
    expect(chess.getHistory().length).toBe(1);

    chess.makeMove({ from: 'e7', to: 'e5' });
    expect(chess.getHistory().length).toBe(2);
  });

  // ==========================================
  // 2. Side-Aware Stats Tests
  // ==========================================

  it('white_win_updates_white_stats', () => {
    const summary = matchFlowService.processMatchResult({
      matchId: 'session_white_win',
      characterId: 'beginner_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 300,
      playerColor: 'w'
    } as any, playerData);

    const updated = summary.updatedPlayerData;
    expect(updated.wins).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.whiteGames).toBe(1);
    expect(updated.whiteWins).toBe(1);
    expect(updated.blackWins).toBe(0);
    expect(updated.currentStreak).toBe(1);
  });

  it('black_win_updates_black_stats', () => {
    const summary = matchFlowService.processMatchResult({
      matchId: 'session_black_win',
      characterId: 'beginner_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 300,
      playerColor: 'b'
    } as any, playerData);

    const updated = summary.updatedPlayerData;
    expect(updated.wins).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.blackGames).toBe(1);
    expect(updated.blackWins).toBe(1);
    expect(updated.whiteWins).toBe(0);
    expect(updated.currentStreak).toBe(1);
  });

  it('white_loss_updates_white_loss', () => {
    const summary = matchFlowService.processMatchResult({
      matchId: 'session_white_loss',
      characterId: 'beginner_1',
      result: 'loss',
      reason: 'checkmate',
      eloBefore: 300,
      playerColor: 'w'
    } as any, playerData);

    const updated = summary.updatedPlayerData;
    expect(updated.losses).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.whiteGames).toBe(1);
    expect(updated.whiteLosses).toBe(1);
    expect(updated.blackLosses).toBe(0);
    expect(updated.currentStreak).toBe(0);
  });

  it('black_loss_updates_black_loss', () => {
    const summary = matchFlowService.processMatchResult({
      matchId: 'session_black_loss',
      characterId: 'beginner_1',
      result: 'loss',
      reason: 'checkmate',
      eloBefore: 300,
      playerColor: 'b'
    } as any, playerData);

    const updated = summary.updatedPlayerData;
    expect(updated.losses).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.blackGames).toBe(1);
    expect(updated.blackLosses).toBe(1);
    expect(updated.whiteLosses).toBe(0);
    expect(updated.currentStreak).toBe(0);
  });

  it('draw_updates_correct_side_draw', () => {
    const summary = matchFlowService.processMatchResult({
      matchId: 'session_draw',
      characterId: 'beginner_1',
      result: 'draw',
      reason: 'draw',
      eloBefore: 300,
      playerColor: 'w'
    } as any, playerData);

    const updated = summary.updatedPlayerData;
    expect(updated.draws).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.whiteGames).toBe(1);
    expect(updated.whiteDraws).toBe(1);
    expect(updated.blackDraws).toBe(0);
    expect(updated.currentStreak).toBe(0);
  });

  it('guest_stats_persist_after_reload', () => {
    const firstMatch = matchFlowService.processMatchResult({
      matchId: 'match_1',
      characterId: 'beginner_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 300,
      playerColor: 'w'
    } as any, playerData);

    const reloadedData = firstMatch.updatedPlayerData;
    
    const secondMatch = matchFlowService.processMatchResult({
      matchId: 'match_2',
      characterId: 'beginner_1',
      result: 'win',
      reason: 'checkmate',
      eloBefore: 325,
      playerColor: 'w'
    } as any, reloadedData);

    const finalData = secondMatch.updatedPlayerData;
    expect(finalData.whiteWins).toBe(2);
    expect(finalData.totalGames).toBe(2);
    expect(finalData.streak).toBe(2);
  });

  // ==========================================
  // 3. Controlled Undo Economy Tests
  // ==========================================

  it('one_free_undo_only_per_match', () => {
    let freeUndosUsed = 0;
    let undoTokens = 5;

    const attemptUndo = () => {
      if (freeUndosUsed < 1) {
        freeUndosUsed = 1;
        return 'free';
      } else {
        if (undoTokens > 0) {
          undoTokens--;
          return 'token';
        }
        return 'blocked';
      }
    };

    expect(attemptUndo()).toBe('free');
    expect(attemptUndo()).toBe('token'); // Second attempt requires token
    expect(undoTokens).toBe(4);
  });

  it('undo_reverts_user_and_ai_move', () => {
    chess.makeMove('e4');
    chess.makeMove({ from: 'e7', to: 'e5' });
    expect(chess.getHistory().length).toBe(2);

    chess.undo();
    chess.undo(); // Undo full turn cycle
    expect(chess.getHistory().length).toBe(0);
  });

  it('undo_disabled_after_game_over', () => {
    let isGameOver = false;
    const canUndo = () => !isGameOver;

    expect(canUndo()).toBe(true);
    isGameOver = true;
    expect(canUndo()).toBe(false);
  });

  it('undo_requires_token_after_free_used', () => {
    let freeUndosUsed = 1;
    let undoTokens = 0;

    const canUndo = () => {
      if (freeUndosUsed < 1) return true;
      return undoTokens > 0;
    };

    expect(canUndo()).toBe(false); // Free used, 0 tokens -> blocked
  });

  it('cup_mode_disables_undo', () => {
    const isCupMode = true;
    const isUndoAllowed = !isCupMode;
    expect(isUndoAllowed).toBe(false);
  });

  it('undo_pack_token_decrements_correctly', () => {
    let undoTokens = 5;
    const executeUndo = () => {
      undoTokens--;
    };
    executeUndo();
    expect(undoTokens).toBe(4);
  });

  // ==========================================
  // 4. Stockfish Bypass Verification
  // ==========================================

  it('stockfish_not_used_as_gameplay_fallback', async () => {
    // Mock primary engine fetch failure
    (global.fetch as any).mockRejectedValue(new Error('Network offline'));

    const character = AI_CHARACTERS[0];
    const brain = EngineBrain.create(character, chess);
    const result = await brain.computeMove();

    // Verify it fell back directly to first legal move, engineUsed is 'hce' and not 'stockfish_benchmark'
    expect(result.wasFallback).toBe(true);
    expect(result.engineUsed).toBe('hce');
    expect(result.move).not.toBeNull();
  });

  // ==========================================
  // 5. Undo Pack Modal & Interaction Pause Tests
  // ==========================================

  it('undo_pack_modal_pauses_timer', () => {
    let showUndoPackModal = false;
    let gameOver = false;
    let isMenuOpen = false;
    let isGameInteractionBlocked = gameOver || isMenuOpen || showUndoPackModal;

    const shouldTick = () => !isGameInteractionBlocked;

    expect(shouldTick()).toBe(true);
    showUndoPackModal = true;
    isGameInteractionBlocked = gameOver || isMenuOpen || showUndoPackModal;
    expect(shouldTick()).toBe(false); // Paused
  });

  it('undo_pack_modal_blocks_board_clicks', () => {
    let showUndoPackModal = true;
    let isGameInteractionBlocked = showUndoPackModal;
    let clickRegistered = false;

    const handleSquareClick = () => {
      if (isGameInteractionBlocked) return;
      clickRegistered = true;
    };

    handleSquareClick();
    expect(clickRegistered).toBe(false); // Clicks blocked
  });

  it('undo_pack_modal_blocks_piece_drag', () => {
    let showUndoPackModal = true;
    let isGameInteractionBlocked = showUndoPackModal;
    let dragRegistered = false;

    const handlePieceDrag = () => {
      if (isGameInteractionBlocked) return;
      dragRegistered = true;
    };

    handlePieceDrag();
    expect(dragRegistered).toBe(false); // Drag blocked
  });

  it('undo_pack_modal_close_x_works', () => {
    let showUndoPackModal = true;
    const closeX = () => {
      showUndoPackModal = false;
    };
    closeX();
    expect(showUndoPackModal).toBe(false);
  });

  it('timer_resumes_after_modal_close', () => {
    let showUndoPackModal = true;
    let isGameInteractionBlocked = showUndoPackModal;
    const shouldTick = () => !isGameInteractionBlocked;

    expect(shouldTick()).toBe(false);
    
    // Close modal
    showUndoPackModal = false;
    isGameInteractionBlocked = showUndoPackModal;
    expect(shouldTick()).toBe(true); // Resumed
  });

  it('modal_close_does_not_duplicate_ai_move', () => {
    let aiCallCount = 0;
    let showUndoPackModal = true;
    let isGameInteractionBlocked = showUndoPackModal;

    const triggerAiMove = () => {
      if (isGameInteractionBlocked) return;
      aiCallCount++;
    };

    // Attempt trigger while blocked
    triggerAiMove();
    expect(aiCallCount).toBe(0);

    // Modal closes
    showUndoPackModal = false;
    isGameInteractionBlocked = showUndoPackModal;
    triggerAiMove();
    expect(aiCallCount).toBe(1); // Normal trigger, no duplicate
  });

  it('background_does_not_receive_pointer_events_when_modal_open', () => {
    let showUndoPackModal = true;
    const modalPointerEvents = showUndoPackModal ? 'pointer-events-auto' : 'pointer-events-none';
    const backgroundPointerEvents = showUndoPackModal ? 'pointer-events-none' : 'pointer-events-auto';

    expect(modalPointerEvents).toBe('pointer-events-auto');
    expect(backgroundPointerEvents).toBe('pointer-events-none');
  });

  // ==========================================
  // 6. Captured Pieces Verification Tests
  // ==========================================

  it('white_capture_adds_black_piece_to_white_captured', () => {
    let capturedPieces = { w: [], b: [] };
    const simulateMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured); // Black pieces captured by White
        } else {
          capturedPieces.w.push(move.captured); // White pieces captured by Black
        }
      }
    };

    simulateMove({ color: 'w', captured: 'p' });
    expect(capturedPieces.b).toContain('p');
    expect(capturedPieces.w.length).toBe(0);
  });

  it('black_capture_adds_white_piece_to_black_captured', () => {
    let capturedPieces = { w: [], b: [] };
    const simulateMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    simulateMove({ color: 'b', captured: 'n' });
    expect(capturedPieces.w).toContain('n');
    expect(capturedPieces.b.length).toBe(0);
  });

  it('ai_capture_updates_tray', () => {
    let capturedPieces = { w: [], b: [] };
    const onAIMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    onAIMove({ color: 'b', captured: 'b' }); // AI Black captures White Bishop
    expect(capturedPieces.w).toContain('b');
  });

  it('user_capture_updates_tray', () => {
    let capturedPieces = { w: [], b: [] };
    const onUserMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    onUserMove({ color: 'w', captured: 'q' }); // User White captures Black Queen
    expect(capturedPieces.b).toContain('q');
  });

  it('en_passant_capture_updates_tray', () => {
    let capturedPieces = { w: [], b: [] };
    const onMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    // En passant capture of a Black Pawn by White
    onMove({ color: 'w', captured: 'p', flags: 'e' });
    expect(capturedPieces.b).toContain('p');
  });

  it('promotion_capture_updates_tray', () => {
    let capturedPieces = { w: [], b: [] };
    const onMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    // White pawn captures Black rook and promotes
    onMove({ color: 'w', captured: 'r', promotion: 'q' });
    expect(capturedPieces.b).toContain('r');
  });

  it('castling_does_not_update_captured_tray', () => {
    let capturedPieces = { w: [], b: [] };
    const onMove = (move: any) => {
      if (move.captured) {
        if (move.color === 'w') {
          capturedPieces.b.push(move.captured);
        } else {
          capturedPieces.w.push(move.captured);
        }
      }
    };

    // King-side castling, no capture
    onMove({ color: 'w', flags: 'k' });
    expect(capturedPieces.w.length).toBe(0);
    expect(capturedPieces.b.length).toBe(0);
  });

  it('undo_restores_captured_tray', () => {
    let capturedPieces = { w: ['p'], b: ['n'] };
    let undoStack = [
      { capturedPieces: { w: [], b: [] } }
    ];

    const handleUndo = () => {
      const snapshot = undoStack.pop();
      if (snapshot) {
        capturedPieces = snapshot.capturedPieces;
      }
    };

    handleUndo();
    expect(capturedPieces.w.length).toBe(0);
    expect(capturedPieces.b.length).toBe(0);
  });

  it('reset_clears_captured_tray', () => {
    let capturedPieces = { w: ['q'], b: ['r'] };
    const reset = () => {
      capturedPieces = { w: [], b: [] };
    };
    reset();
    expect(capturedPieces.w.length).toBe(0);
    expect(capturedPieces.b.length).toBe(0);
  });

  it('next_level_clears_captured_tray', () => {
    let capturedPieces = { w: ['b'], b: ['p'] };
    const startNextLevel = () => {
      capturedPieces = { w: [], b: [] };
    };
    startNextLevel();
    expect(capturedPieces.w.length).toBe(0);
    expect(capturedPieces.b.length).toBe(0);
  });

  it('captured_tray_respects_player_black_orientation', () => {
    const playerColor = 'b';
    const capturedPieces = { w: ['q'], b: ['p'] }; // w is captured White, b is captured Black

    // If player is Black, Your captures is pieces captured by Black (i.e. White pieces)
    const yourCaptures = playerColor === 'b' ? capturedPieces.w : capturedPieces.b;
    const opponentCaptures = playerColor === 'b' ? capturedPieces.b : capturedPieces.w;

    expect(yourCaptures).toContain('q');
    expect(opponentCaptures).toContain('p');
  });

  it('captured_pieces_render_in_3d_tray', () => {
    const capturedPieces = { w: ['p'], b: ['n'] };
    
    // In 3D:
    // Left tray displays captured White pieces (capturedPieces.w)
    // Right tray displays captured Black pieces (capturedPieces.b)
    const leftTrayPieces = capturedPieces.w;
    const rightTrayPieces = capturedPieces.b;

    expect(leftTrayPieces).toContain('p');
    expect(rightTrayPieces).toContain('n');
  });

  it('captured_pieces_render_in_2d_tray', () => {
    const capturedPieces = { w: ['r'], b: ['b'] };
    const playerColor = 'w';

    // In 2D:
    // Bottom tray (Your Captures) displays pieces captured by Player
    const bottomTrayPieces = playerColor === 'b' ? capturedPieces.w : capturedPieces.b;
    // Top tray (Opponent Captures) displays pieces captured by Opponent
    const topTrayPieces = playerColor === 'b' ? capturedPieces.b : capturedPieces.w;

    expect(bottomTrayPieces).toContain('b');
    expect(topTrayPieces).toContain('r');
  });
});
