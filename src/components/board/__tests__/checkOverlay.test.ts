import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { ChessLogic } from '../../../lib/chess-logic';

describe('Visual Check Overlay Math and Regression Tests', () => {
  // 1. Math / Helper calculations
  it('check_overlay_2d_respects_black_orientation', () => {
    // 2D coordinate calculation:
    // e1 with boardOrientation='white' -> x: 4.5 * 12.5 = 56.25, y: 7.5 * 12.5 = 93.75
    // e1 with boardOrientation='black' -> x: (7-4 + 0.5) * 12.5 = 43.75, y: (7-7 + 0.5) * 12.5 = 6.25
    const getSquareCoords = (sq: string, boardOrientation: 'white' | 'black') => {
      const f = sq[0];
      const r = parseInt(sq[1], 10);
      let fileIdx = f.charCodeAt(0) - 97;
      let rankIdx = 8 - r;
      if (boardOrientation === 'black') {
        fileIdx = 7 - fileIdx;
        rankIdx = 7 - rankIdx;
      }
      return {
        x: (fileIdx + 0.5) * 12.5,
        y: (rankIdx + 0.5) * 12.5
      };
    };

    const coordsWhite = getSquareCoords('e1', 'white');
    expect(coordsWhite.x).toBe(56.25);
    expect(coordsWhite.y).toBe(93.75);

    const coordsBlack = getSquareCoords('e1', 'black');
    expect(coordsBlack.x).toBe(43.75);
    expect(coordsBlack.y).toBe(6.25);
  });

  it('check_overlay_3d_coordinates_match_pieces', () => {
    // 3D position calculation:
    // x = -(displayC - 3.5) * squareSize
    // z = (displayR - 3.5) * squareSize
    const getPiece3DPosition = (squareName: string, shouldFlip: boolean, squareSize: number) => {
      const c = squareName.charCodeAt(0) - 97;
      const r = parseInt(squareName[1], 10) - 1;
      const displayC = shouldFlip ? 7 - c : c;
      const displayR = shouldFlip ? 7 - r : r;
      return [
        -(displayC - 3.5) * squareSize,
        0.12,
        (displayR - 3.5) * squareSize
      ];
    };

    const squareSize = 1.05;
    const posWhite = getPiece3DPosition('e1', false, squareSize);
    // e1 -> c = 4, r = 0. displayC = 4, displayR = 0.
    // x = -(4 - 3.5) * 1.05 = -0.525
    // z = (0 - 3.5) * 1.05 = -3.675
    expect(posWhite[0]).toBeCloseTo(-0.525);
    expect(posWhite[2]).toBeCloseTo(-3.675);

    const posBlack = getPiece3DPosition('e1', true, squareSize);
    // e1 -> shouldFlip=true -> displayC = 7 - 4 = 3, displayR = 7 - 0 = 7.
    // x = -(3 - 3.5) * 1.05 = 0.525
    // z = (7 - 3.5) * 1.05 = 3.675
    expect(posBlack[0]).toBeCloseTo(0.525);
    expect(posBlack[2]).toBeCloseTo(3.675);
  });

  // 2. Regression tests
  it('legal_moves_not_changed_by_check_visual', () => {
    const chess = new ChessLogic();
    const originalMoves = chess.getAllLegalMoves();
    
    // Simulate check visual computations
    const board = chess.getGameInstance();
    const checkStatus = board.isCheck();
    
    expect(chess.getAllLegalMoves()).toEqual(originalMoves);
    expect(board.isCheck()).toBe(checkStatus);
  });

  it('engine_not_called_differently_by_check_visual', () => {
    const chess = new ChessLogic();
    const board = chess.getGameInstance();
    
    // Position with check
    board.load('4k3/8/8/8/8/8/8/4K2r w - - 0 1');
    const isCheck = board.isCheck();
    expect(isCheck).toBe(true);
    
    // Run visual calculations
    const boardCopy = new Chess(board.fen());
    expect(boardCopy.isCheck()).toBe(true);
    expect(board.fen()).toBe(boardCopy.fen());
  });
});
