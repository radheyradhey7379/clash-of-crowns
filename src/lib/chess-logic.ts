import { Chess, Move } from 'chess.js';
import { getAIDepth } from './elo-system';

// Zobrist Hashing Constants
const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const COLORS = ['w', 'b'];
const SQUARES = 64;

class Zobrist {
  static pieceKeys: number[][][] = [];
  static sideKey: number;

  static init() {
    if (this.pieceKeys.length > 0) return;
    
    // Generate random 32-bit integers (JS bitwise ops are 32-bit)
    const random = () => Math.floor(Math.random() * 0xFFFFFFFF);

    for (let p = 0; p < 6; p++) {
      this.pieceKeys[p] = [];
      for (let c = 0; c < 2; c++) {
        this.pieceKeys[p][c] = [];
        for (let s = 0; s < 64; s++) {
          this.pieceKeys[p][c][s] = random();
        }
      }
    }
    this.sideKey = random();
  }

  static getHash(game: Chess): number {
    let h = 0;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const pIdx = PIECE_TYPES.indexOf(piece.type);
          const cIdx = piece.color === 'w' ? 0 : 1;
          const sIdx = r * 8 + c;
          h ^= this.pieceKeys[pIdx][cIdx][sIdx];
        }
      }
    }
    if (game.turn() === 'b') h ^= this.sideKey;
    return h;
  }
}

try {
  Zobrist.init();
} catch (e) {
  console.error("Zobrist initialization failed:", e);
}

// Piece-Square Tables (PST)
// Values are from the perspective of White. For Black, we flip the table.
const PST: { [key: string]: number[] } = {
  p: [
    0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

interface TTEntry {
  depth: number;
  value: number;
  type: 'exact' | 'lower' | 'upper';
}

export class ChessLogic {
  private game: Chess;
  private transpositionTable: Map<number, TTEntry> = new Map();
  private readonly MAX_TT_SIZE = 50000;
  private accumulator: number = 0; // Incremental evaluation score
  private style: { aggression: number; defense: number; openingKnowledge: number; endgameSkill: number } | null = null;

  setAIStyle(style: { aggression: number; defense: number; openingKnowledge: number; endgameSkill: number } | null) {
    this.style = style;
  }

  constructor(fen?: string) {
    this.game = new Chess(fen);
    this.initAccumulator();
  }

  // --- Requested Function Aliases (from HTML/JS version) ---
  initBoard(fen?: string) {
    this.game = new Chess(fen);
    this.initAccumulator();
    this.transpositionTable.clear();
  }

  aiMove(depth: number, blunderRate: number): Move | null {
    return this.getBestMove(depth, blunderRate);
  }

  getAllLegalMoves() {
    return this.game.moves({ verbose: true });
  }

  executeMove(move: string | { from: string; to: string; promotion?: string }) {
    return this.makeMove(move);
  }

  isKingInCheck() {
    return this.game.isCheck();
  }

  pathClear(from: string, to: string): boolean {
    // Basic implementation: check if any pieces are between from and to
    // Note: chess.js handles this internally for move generation
    const moves = this.game.moves({ square: from as any, verbose: true });
    return moves.some(m => m.to === to);
  }

  isSquareAttacked(square: string, color: 'w' | 'b'): boolean {
    // chess.js provides isAttacked(square, color)
    return (this.game as any).isAttacked(square, color);
  }

  simulateMove(move: any): number {
    const m = this.game.move(move);
    if (!m) return -Infinity;
    const score = this.evaluateBoard();
    this.game.undo();
    return score;
  }

  recordPosition() {
    return this.game.fen();
  }
  // ---------------------------------------------------------

  private initAccumulator() {
    this.accumulator = this.calculateFullEvaluation();
  }

  private calculateFullEvaluation(): number {
    let score = 0;
    const board = this.game.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece) {
          const val = this.getPieceValue(piece.type);
          const pstVal = this.getPSTValue(piece.type, piece.color, i, j);
          score += (piece.color === 'w' ? val + pstVal : -(val + pstVal));
        }
      }
    }
    return score;
  }

  private getPSTValue(type: string, color: string, r: number, c: number): number {
    const squareIdx = r * 8 + c;
    const pstIdx = color === 'w' ? squareIdx : (7 - r) * 8 + c;
    return PST[type][pstIdx] || 0;
  }

  getBoard() {
    return this.game.board();
  }

  getTurn() {
    return this.game.turn();
  }

  getHistory(options?: { verbose: boolean }) {
    return this.game.history(options);
  }

  getFen() {
    return this.game.fen();
  }

  load(fen: string) {
    try {
      this.game.load(fen);
      this.initAccumulator();
      return true;
    } catch (e) {
      return false;
    }
  }

  isGameOver() {
    return this.game.isGameOver();
  }

  isCheck() {
    return this.game.isCheck();
  }

  isCheckmate() {
    return this.game.isCheckmate();
  }

  isDraw() {
    return this.game.isDraw();
  }

  isStalemate() {
    return this.game.isStalemate();
  }

  isThreefoldRepetition() {
    return this.game.isThreefoldRepetition();
  }

  isInsufficientMaterial() {
    return this.game.isInsufficientMaterial();
  }

  getMoves(square?: any) {
    return this.game.moves({ square, verbose: true });
  }

  makeMove(move: string | { from: string; to: string; promotion?: string }) {
    try {
      const m = this.game.move(move);
      if (m) {
        this.updateAccumulator(m, true);
      }
      return m;
    } catch (e) {
      return null;
    }
  }

  undo() {
    const m = this.game.undo();
    if (m) {
      this.updateAccumulator(m, false);
    }
    return m;
  }

  private updateAccumulator(move: Move, isForward: boolean) {
    const multiplier = isForward ? 1 : -1;
    const colorMult = move.color === 'w' ? 1 : -1;
    
    // 1. Handle regular move (remove from source, add to destination)
    const fromCoords = this.algebraicToCoords(move.from);
    const fromPst = this.getPSTValue(move.piece, move.color, fromCoords.r, fromCoords.c);
    this.accumulator -= multiplier * colorMult * (this.getPieceValue(move.piece) + fromPst);

    const toCoords = this.algebraicToCoords(move.to);
    const toPst = this.getPSTValue(move.piece, move.color, toCoords.r, toCoords.c);
    this.accumulator += multiplier * colorMult * (this.getPieceValue(move.piece) + toPst);

    // 2. Handle capture
    if (move.captured) {
      const victimColor = move.color === 'w' ? 'b' : 'w';
      const victimMult = victimColor === 'w' ? 1 : -1;
      
      // En Passant capture square is different from 'to' square
      let captureCoords = toCoords;
      if (move.flags.includes('e')) {
        captureCoords = { r: fromCoords.r, c: toCoords.c };
      }
      
      const victimPst = this.getPSTValue(move.captured, victimColor, captureCoords.r, captureCoords.c);
      // If forward, we remove the victim. If backward, we add it back.
      this.accumulator -= multiplier * victimMult * (this.getPieceValue(move.captured) + victimPst);
    }

    // 3. Handle promotion
    if (move.promotion) {
      // Remove the pawn that was added to 'to'
      this.accumulator -= multiplier * colorMult * (this.getPieceValue('p') + toPst);
      // Add the promoted piece
      const promPst = this.getPSTValue(move.promotion, move.color, toCoords.r, toCoords.c);
      this.accumulator += multiplier * colorMult * (this.getPieceValue(move.promotion) + promPst);
    }

    // 4. Handle castling (rook move)
    if (move.flags.includes('k') || move.flags.includes('q')) {
      const isKingside = move.flags.includes('k');
      const rank = move.color === 'w' ? 7 : 0;
      const rookFromCol = isKingside ? 7 : 0;
      const rookToCol = isKingside ? 5 : 3;
      
      const rookFromPst = this.getPSTValue('r', move.color, rank, rookFromCol);
      const rookToPst = this.getPSTValue('r', move.color, rank, rookToCol);
      
      // Remove rook from original square
      this.accumulator -= multiplier * colorMult * (this.getPieceValue('r') + rookFromPst);
      // Add rook to new square
      this.accumulator += multiplier * colorMult * (this.getPieceValue('r') + rookToPst);
    }
  }

  private algebraicToCoords(s: string) {
    return {
      r: 8 - parseInt(s[1]),
      c: s.charCodeAt(0) - 97
    };
  }

  reset() {
    this.game.reset();
    this.initAccumulator();
    this.transpositionTable.clear();
  }

  // Improved AI using Negamax with Alpha-Beta Pruning, TT, Move Ordering, PVS, and Iterative Deepening
  getBestMove(depth: number, blunderRate: number): Move | null {
    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) return null;

    const maxDepth = depth;

    // Blunder chance
    if (Math.random() < blunderRate) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = moves[0];
    let bestValue = -Infinity;

    // Iterative Deepening
    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      const orderedMoves = this.orderMoves(moves);
      let depthBestMove = null;
      let depthBestValue = -Infinity;

      for (let i = 0; i < orderedMoves.length; i++) {
        const move = orderedMoves[i];
        this.makeMove(move);
        
        let val;
        if (i === 0) {
          // Full window search for the first move
          val = -this.negamax(currentDepth - 1, -Infinity, Infinity);
        } else {
          // Null window search for subsequent moves (PVS)
          val = -this.negamax(currentDepth - 1, -depthBestValue - 1, -depthBestValue);
          if (val > depthBestValue) {
            // Re-search with full window if PVS failed high
            val = -this.negamax(currentDepth - 1, -Infinity, -depthBestValue);
          }
        }
        
        this.undo();

        if (val > depthBestValue) {
          depthBestValue = val;
          depthBestMove = move;
        }
      }

      if (depthBestMove) {
        bestMove = depthBestMove;
        bestValue = depthBestValue;
      }
      
      // If we found a checkmate, we can stop searching deeper
      if (bestValue > 15000) break;
    }

    return bestMove;
  }

  private orderMoves(moves: Move[]): Move[] {
    return moves.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Capture priority (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
      if (a.captured) {
        scoreA += 10 * this.getPieceValue(a.captured) - this.getPieceValue(a.piece);
      }
      if (b.captured) {
        scoreB += 10 * this.getPieceValue(b.captured) - this.getPieceValue(b.piece);
      }

      // Promotion priority
      if (a.promotion) scoreA += 900;
      if (b.promotion) scoreB += 900;

      // Check priority
      if (a.san.includes('+')) scoreA += 50;
      if (b.san.includes('+')) scoreB += 50;

      return scoreB - scoreA;
    });
  }

  private getPieceValue(type: string): number {
    const values: { [key: string]: number } = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    return values[type] || 0;
  }

  private negamax(depth: number, alpha: number, beta: number): number {
    const hash = Zobrist.getHash(this.game);
    const ttEntry = this.transpositionTable.get(hash);

    // TT Lookup
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.type === 'exact') return ttEntry.value;
      if (ttEntry.type === 'lower' && ttEntry.value >= beta) return ttEntry.value;
      if (ttEntry.type === 'upper' && ttEntry.value <= alpha) return ttEntry.value;
    }

    if (depth === 0) {
      return this.quiescenceSearch(alpha, beta);
    }

    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) {
      if (this.game.isCheckmate()) return -20000 - depth; // Loss for side to move
      return 0; // Draw
    }

    const orderedMoves = this.orderMoves(moves);
    let bestValue = -Infinity;
    let type: 'exact' | 'lower' | 'upper' = 'upper';

    for (let i = 0; i < orderedMoves.length; i++) {
      const move = orderedMoves[i];
      this.makeMove(move);
      
      let val;
      if (i === 0) {
        val = -this.negamax(depth - 1, -beta, -alpha);
      } else {
        // PVS: Null window search
        val = -this.negamax(depth - 1, -alpha - 1, -alpha);
        if (val > alpha && val < beta) {
          val = -this.negamax(depth - 1, -beta, -alpha);
        }
      }
      
      this.undo();

      if (val >= beta) {
        // Fail-high (beta cutoff)
        if (this.transpositionTable.size < this.MAX_TT_SIZE) {
          this.transpositionTable.set(hash, { depth, value: val, type: 'lower' });
        }
        return val;
      }
      if (val > bestValue) {
        bestValue = val;
        if (val > alpha) {
          alpha = val;
          type = 'exact';
        }
      }
    }

    if (this.transpositionTable.size < this.MAX_TT_SIZE) {
      this.transpositionTable.set(hash, { depth, value: bestValue, type });
    }
    return bestValue;
  }

  private quiescenceSearch(alpha: number, beta: number): number {
    // Use the accumulator for fast evaluation
    const standPat = this.evaluateBoard() * (this.game.turn() === 'w' ? 1 : -1);
    
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = this.game.moves({ verbose: true }).filter(m => m.captured);
    const orderedMoves = this.orderMoves(moves);

    for (const move of orderedMoves) {
      this.makeMove(move);
      const score = -this.quiescenceSearch(-beta, -alpha);
      this.undo();

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  evaluateBoard(): number {
    let score = this.accumulator;
    if (!this.style) return score;

    const board = this.game.board();
    let whiteKingCoords = { r: 7, c: 4 };
    let blackKingCoords = { r: 0, c: 4 };
    
    // Find kings
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k') {
          if (piece.color === 'w') whiteKingCoords = { r, c };
          else blackKingCoords = { r, c };
        }
      }
    }

    let styleAdjustment = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type !== 'k') {
          const isWhite = piece.color === 'w';
          const opponentKing = isWhite ? blackKingCoords : whiteKingCoords;
          const friendlyKing = isWhite ? whiteKingCoords : blackKingCoords;

          // Distance to opponent king (Manhattan distance)
          const distToOpponentKing = Math.abs(r - opponentKing.r) + Math.abs(c - opponentKing.c);
          // Distance to friendly king
          const distToFriendlyKing = Math.abs(r - friendlyKing.r) + Math.abs(c - friendlyKing.c);

          // Aggression: reward being close to opponent king
          const aggBonus = (14 - distToOpponentKing) * this.style.aggression * 5;

          // Defense: reward being close to friendly king
          const defBonus = (14 - distToFriendlyKing) * this.style.defense * 5;

          const totalBonus = aggBonus + defBonus;
          styleAdjustment += isWhite ? totalBonus : -totalBonus;
        }
      }
    }

    // Apply opening knowledge / endgame skill adjustments
    const moveCount = this.game.history().length;
    if (moveCount < 15) {
      // Reward controlling center squares (d4, d5, e4, e5)
      const centerSquares = [[3, 3], [3, 4], [4, 3], [4, 4]];
      for (const [cr, cc] of centerSquares) {
        const piece = board[cr][cc];
        if (piece) {
          const isWhite = piece.color === 'w';
          const bonus = this.style.openingKnowledge * 15;
          styleAdjustment += isWhite ? bonus : -bonus;
        }
      }
    } else {
      // Endgame skill: if total pieces are low, reward pawn promotion pushes
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'p') {
            const isWhite = piece.color === 'w';
            const advancement = isWhite ? (7 - r) : r;
            const bonus = advancement * this.style.endgameSkill * 10;
            styleAdjustment += isWhite ? bonus : -bonus;
          }
        }
      }
    }

    return score + styleAdjustment;
  }
}
