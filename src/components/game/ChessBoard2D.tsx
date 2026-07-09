import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import CheckAttackOverlay2D from '../board/CheckAttackOverlay2D';

interface ChessBoard2DProps {
  board: any[][];
  selectedSquare: string | null;
  validMoves: any[];
  lastMove: { from: string; to: string } | null;
  onSquareClick: (square: string) => void;
  playerColor: 'w' | 'b' | null;
  checkInfo: { king: string; checker: string } | null;
  turn?: 'w' | 'b';
  bestMoveArrow?: { from: string; to: string; color?: string } | null;
  checkVisual?: { isCheck: boolean; kingSquare: string | null; attackerSquares: string[] };
}

const PIECE_UNICODE: { [key: string]: string } = {
  'wp': '♙', 'wr': '♖', 'wn': '♘', 'wb': '♗', 'wq': '♕', 'wk': '♔',
  'bp': '♟', 'br': '♜', 'bn': '♞', 'bb': '♝', 'bq': '♛', 'bk': '♚'
};

export default function ChessBoard2D({
  board,
  selectedSquare,
  validMoves,
  lastMove,
  onSquareClick,
  playerColor,
  checkInfo,
  turn,
  bestMoveArrow,
  checkVisual
}: ChessBoard2DProps) {
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Flip board if playing as black
  const displayRanks = playerColor === 'b' ? [...ranks].reverse() : ranks;
  const displayFiles = playerColor === 'b' ? [...files].reverse() : files;

  // Helper to get center coordinates (%) of a square for arrow drawing
  const getSquareCoords = (sq: string) => {
    if (sq.length < 2) return { x: 50, y: 50 };
    const f = sq[0];
    const r = parseInt(sq[1], 10);
    
    let fileIdx = f.charCodeAt(0) - 97;
    let rankIdx = 8 - r;
    
    if (playerColor === 'b') {
      fileIdx = 7 - fileIdx;
      rankIdx = 7 - rankIdx;
    }
    
    return {
      x: (fileIdx + 0.5) * 12.5,
      y: (rankIdx + 0.5) * 12.5
    };
  };

  const arrow = bestMoveArrow ? {
    start: getSquareCoords(bestMoveArrow.from),
    end: getSquareCoords(bestMoveArrow.to),
    color: bestMoveArrow.color || '#4ec97a' // default green
  } : null;

  return (
    <div className="aspect-square h-full max-h-full w-auto bg-[#2a2a2a] p-1 md:p-2 rounded-lg shadow-2xl border-2 md:border-4 border-[#3a3a3a] flex items-center justify-center relative">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border border-[#1a1a1a] relative">
        {displayRanks.map((rank, rIdx) => (
          displayFiles.map((file, fIdx) => {
            const square = `${file}${rank}`;
            const piece = board[8 - rank][file.charCodeAt(0) - 97];
            const isDark = (rank + file.charCodeAt(0)) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.some(m => m.to === square);
            const isFrom = lastMove && lastMove.from === square;
            const isTo = lastMove && lastMove.to === square;
            const isCheck = checkInfo?.king === square;

            return (
              <div
                key={square}
                onClick={() => onSquareClick(square)}
                className={cn(
                  "relative flex items-center justify-center cursor-pointer transition-colors duration-200",
                  isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]",
                  isSelected && "bg-[#f5f682] z-20",
                  isFrom && !isSelected && "bg-[#8b2d32] z-10",
                  isTo && !isSelected && "bg-[#35723c] z-10"
                )}
              >
                {/* Square Label (optional, but good for 2D) */}
                {fIdx === 0 && (
                  <span className={cn(
                    "absolute top-0.5 left-0.5 text-[6px] sm:text-[8px] font-bold",
                    isDark ? "text-[#f0d9b5]" : "text-[#b58863]"
                  )}>
                    {rank}
                  </span>
                )}
                {rIdx === 7 && (
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 text-[6px] sm:text-[8px] font-bold",
                    isDark ? "text-[#f0d9b5]" : "text-[#b58863]"
                  )}>
                    {file}
                  </span>
                )}

                {/* Valid Move Indicator */}
                {isValidMove && (
                  <div className={cn(
                    "absolute w-2 h-2 sm:w-4 sm:h-4 rounded-full z-20",
                    piece ? "border-2 sm:border-4 border-black/20 w-full h-full rounded-none" : "bg-black/10"
                  )} />
                )}

                {/* Piece */}
                {piece && (
                  <div
                    key={`${square}-${piece.color}-${piece.type}`}
                    className={cn(
                      "w-full h-full z-10 flex items-center justify-center text-2xl xs:text-3xl sm:text-4xl md:text-5xl select-none",
                      piece.color === 'w' ? "text-white [text-shadow:0_0_2px_black,0_0_2px_black,0_0_2px_black]" : "text-black"
                    )}
                  >
                    {PIECE_UNICODE[piece.color + piece.type]}
                  </div>
                )}
              </div>
            );
          })
        ))}

        {/* SVG Arrow Overlay */}
        {arrow && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
            <defs>
              <marker
                id={`arrowhead-${bestMoveArrow?.from}-${bestMoveArrow?.to}`}
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L8,3 L0,6 Z" fill={arrow.color} />
              </marker>
            </defs>
            <line
              x1={`${arrow.start.x}%`}
              y1={`${arrow.start.y}%`}
              x2={`${arrow.end.x}%`}
              y2={`${arrow.end.y}%`}
              stroke={arrow.color}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
              markerEnd={`url(#arrowhead-${bestMoveArrow?.from}-${bestMoveArrow?.to})`}
            />
          </svg>
        )}

        {checkVisual && (
          <CheckAttackOverlay2D
            boardOrientation={playerColor === 'b' ? 'black' : 'white'}
            attackerSquares={checkVisual.attackerSquares}
            kingSquare={checkVisual.kingSquare}
            isCheck={checkVisual.isCheck}
          />
        )}
      </div>
    </div>
  );
}
