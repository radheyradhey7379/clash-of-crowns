import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface ChessBoard2DProps {
  board: any[][];
  selectedSquare: string | null;
  validMoves: any[];
  lastMove: { from: string; to: string } | null;
  onSquareClick: (square: string) => void;
  playerColor: 'w' | 'b' | null;
  checkInfo: { king: string; checker: string } | null;
  turn?: 'w' | 'b';
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
  turn
}: ChessBoard2DProps) {
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Flip board if playing as black
  const displayRanks = playerColor === 'b' ? [...ranks].reverse() : ranks;
  const displayFiles = playerColor === 'b' ? [...files].reverse() : files;

  return (
    <div className="aspect-square h-full max-h-full w-auto bg-[#2a2a2a] p-1 md:p-2 rounded-lg shadow-2xl border-2 md:border-4 border-[#3a3a3a] flex items-center justify-center">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full border border-[#1a1a1a]">
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
                  isFrom && !isSelected && !isCheck && "bg-[#8b2d32] z-10",
                  isTo && !isSelected && !isCheck && "bg-[#35723c] z-10",
                  isCheck && "bg-red-600 z-20 animate-pulse shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]"
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
      </div>
    </div>
  );
}
