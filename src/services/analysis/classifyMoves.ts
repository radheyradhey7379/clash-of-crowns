import { StockfishEvalResult, AnalyzedMove, MoveClassification, MoveStatistics } from './analysisTypes';
import { ChessLogic } from '../../lib/chess-logic';

/**
 * Normalizes score to centipawns from White's perspective, accounting for mate values.
 */
function getNormalizedScore(evalRes: StockfishEvalResult): number {
  if (evalRes.isMateScore && evalRes.mateIn !== null) {
    // If white has a mate, score is high. If black has a mate, score is low.
    return evalRes.mateIn > 0 ? 10000 - evalRes.mateIn : -10000 - evalRes.mateIn;
  }
  return evalRes.evalCp;
}

/**
 * Formats a UCI move (e.g. "e2e4") into standard notation or matches it.
 */
function convertUciToSan(fenBefore: string, uciMove: string): string {
  if (!uciMove) return '';
  const chess = new ChessLogic(fenBefore);
  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promo = uciMove.length === 5 ? uciMove[4] : undefined;
  
  const m = chess.makeMove({ from, to, promotion: promo });
  return m ? m.san : uciMove;
}

/**
 * Checks if a played SAN move matches the best move UCI.
 */
function isMoveMatch(playedMoveSan: string, bestMoveUci: string, fenBefore: string): boolean {
  if (!bestMoveUci) return false;
  const chess = new ChessLogic(fenBefore);
  const m = chess.makeMove(playedMoveSan);
  if (!m) return false;
  const uci = `${m.from}${m.to}${m.promotion || ''}`;
  return uci === bestMoveUci;
}

/**
 * Classifies a move based on centipawn loss and game context.
 */
export function classifyAndAnalyze(
  evals: StockfishEvalResult[],
  history: { fen: string; move: string; side: string; moveNumber: number }[],
  playerColor: 'w' | 'b'
) {
  const analyzedMoves: AnalyzedMove[] = [];
  
  const statistics: MoveStatistics = {
    brilliant: 0,
    best: 0,
    excellent: 0,
    good: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0
  };

  let totalPlayerCpl = 0;
  let playerMovesCount = 0;
  let totalOpponentCpl = 0;
  let opponentMovesCount = 0;

  // Starting position FEN is standard if history index is 0
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const fenBefore = i === 0 ? startFen : history[i - 1].fen;
    const currentEval = evals[i];
    const prevEval = i === 0 ? {
      evalCp: 35, // average starting evaluation
      bestMoveUci: '',
      isMateScore: false,
      mateIn: null,
      depth: 10,
      pv: []
    } : evals[i - 1];

    const currentScore = getNormalizedScore(currentEval);
    const prevScore = getNormalizedScore(prevEval);

    // swing = eval change from moving player's perspective
    const side = item.side as 'White' | 'Black';
    const isPlayer = (side === 'White' && playerColor === 'w') || (side === 'Black' && playerColor === 'b');
    
    const swing = side === 'White' ? currentScore - prevScore : prevScore - currentScore;
    const cpl = Math.max(0, -swing);

    // Track ACPL
    if (isPlayer) {
      totalPlayerCpl += cpl;
      playerMovesCount++;
    } else {
      totalOpponentCpl += cpl;
      opponentMovesCount++;
    }

    // Determine Classification
    let classification: MoveClassification = 'good';
    const isBest = isMoveMatch(item.move, currentEval.bestMoveUci, fenBefore);

    // Check Brilliant condition (Conservative: played best move, significant swing in favor, complex position)
    const isBrilliant = isBest && swing >= 150 && Math.abs(prevScore) < 400;

    if (isBrilliant) {
      classification = 'brilliant';
    } else if (isBest) {
      classification = 'best';
    } else if (cpl <= 12) {
      classification = 'excellent';
    } else if (cpl <= 28) {
      classification = 'good';
    } else if (cpl <= 55) {
      classification = 'inaccuracy';
    } else if (cpl <= 160) {
      classification = 'mistake';
    } else {
      classification = 'blunder';
    }

    // Update stats
    statistics[classification]++;

    // Best move SAN representation
    const bestMoveSan = convertUciToSan(fenBefore, currentEval.bestMoveUci);

    // Generate Comment
    const comment = generateComment(
      item.move,
      classification,
      currentEval.evalCp,
      bestMoveSan,
      cpl,
      currentEval.isMateScore,
      currentEval.mateIn
    );

    analyzedMoves.push({
      fen: item.fen,
      playedMove: item.move,
      bestMoveUci: currentEval.bestMoveUci,
      bestMoveSan: bestMoveSan || currentEval.bestMoveUci,
      evalCp: currentEval.evalCp,
      prevEvalCp: prevEval.evalCp,
      cpl,
      classification,
      comment,
      side,
      moveNumber: item.moveNumber,
      isMateScore: currentEval.isMateScore,
      mateIn: currentEval.mateIn
    });
  }

  // Calculate ACPL
  const playerACPL = playerMovesCount > 0 ? Math.round(totalPlayerCpl / playerMovesCount) : 0;
  const opponentACPL = opponentMovesCount > 0 ? Math.round(totalOpponentCpl / opponentMovesCount) : 0;

  // Lichess accuracy formula: accuracy = 103.1668 * exp(-0.04354 * ACPL) - 3.1668
  const calcAccuracy = (acpl: number) => {
    const raw = 103.1668 * Math.exp(-0.04354 * acpl) - 3.1668;
    return Math.max(0, Math.min(100, Math.round(raw)));
  };

  const playerAccuracy = calcAccuracy(playerACPL);
  const opponentAccuracy = calcAccuracy(opponentACPL);

  // Compute King Safety Heuristic
  const finalFen = history.length > 0 ? history[history.length - 1].fen : startFen;
  const kingSafety = computeKingSafety(finalFen);

  return {
    moves: analyzedMoves,
    playerAccuracy,
    opponentAccuracy,
    playerACPL,
    opponentACPL,
    statistics,
    kingSafety
  };
}

/**
 * Generates natural language commentary for each move.
 */
function generateComment(
  move: string,
  classification: MoveClassification,
  evalCp: number,
  bestMoveSan: string,
  cpl: number,
  isMateScore: boolean,
  mateIn: number | null
): string {
  const evalInPawns = (evalCp / 100).toFixed(1);
  const evalText = isMateScore 
    ? `Mate in ${mateIn ? Math.abs(mateIn) : '?'}` 
    : `${evalCp >= 0 ? '+' : ''}${evalInPawns}`;

  switch (classification) {
    case 'brilliant':
      return `Brilliant! ${move} is a fantastic finding that creates a massive advantage. Best move recommendations are locked.`;
    case 'best':
      return `Best move! ${move} is exactly what the engine recommended. Position eval: ${evalText}.`;
    case 'excellent':
      return `Excellent move. ${move} keeps the position strong and active. Position eval: ${evalText}.`;
    case 'good':
      return `A solid move. ${move} maintains a steady balance in the position. Eval: ${evalText}.`;
    case 'inaccuracy':
      return `An inaccuracy. ${move} was okay, but playing ${bestMoveSan || 'something else'} would have been better (lost ${cpl}cp).`;
    case 'mistake':
      return `Mistake. ${move} yields too much ground to the opponent. Better was ${bestMoveSan || 'another option'} (lost ${cpl}cp).`;
    case 'blunder':
      return `Blunder! ${move} is a major mistake that severely weakens the position. Recommended was ${bestMoveSan || 'another move'} (lost ${cpl}cp).`;
    default:
      return `Played ${move}. Position evaluation: ${evalText}.`;
  }
}

/**
 * Heuristic estimation of king safety (0 to 100) based on pawn shield and castle status
 */
function computeKingSafety(fen: string): { white: number; black: number } {
  // Safe default
  let whiteSafety = 75;
  let blackSafety = 75;

  const parts = fen.split(' ');
  const board = parts[0];
  const castlingRights = parts[2] || '';

  // 1. Check Castling Status / Rights
  // If king has castled (determined heuristically if rights are gone but pieces moved)
  const whiteCanCastle = castlingRights.includes('K') || castlingRights.includes('Q');
  const blackCanCastle = castlingRights.includes('k') || castlingRights.includes('q');

  // Simple pawn shield count (files f, g, h or b, c, d depending on where king resides)
  // Let's inspect board row layouts
  const rows = board.split('/');
  
  // Find King positions
  let whiteKingCol = 4;
  let blackKingCol = 4;
  
  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (let c = 0; c < rows[r].length; c++) {
      const char = rows[r][c];
      if (isNaN(Number(char))) {
        if (char === 'K') whiteKingCol = col;
        if (char === 'k') blackKingCol = col;
        col++;
      } else {
        col += Number(char);
      }
    }
  }

  // White King Safety
  if (whiteKingCol >= 5) {
    // Kingside castle or resides there. Count pawns on f2, g2, h2 (rows[6])
    let pawns = 0;
    const row6 = rows[6] || '';
    if (row6.includes('P')) pawns += 2;
    whiteSafety = 50 + pawns * 15;
  } else if (whiteKingCol <= 2) {
    // Queenside
    let pawns = 0;
    const row6 = rows[6] || '';
    if (row6.includes('P')) pawns += 2;
    whiteSafety = 50 + pawns * 15;
  } else {
    // Central king (exposed)
    whiteSafety = whiteCanCastle ? 65 : 45;
  }

  // Black King Safety
  if (blackKingCol >= 5) {
    let pawns = 0;
    const row1 = rows[1] || '';
    if (row1.includes('p')) pawns += 2;
    blackSafety = 50 + pawns * 15;
  } else if (blackKingCol <= 2) {
    let pawns = 0;
    const row1 = rows[1] || '';
    if (row1.includes('p')) pawns += 2;
    blackSafety = 50 + pawns * 15;
  } else {
    blackSafety = blackCanCastle ? 65 : 45;
  }

  return {
    white: Math.max(10, Math.min(95, whiteSafety)),
    black: Math.max(10, Math.min(95, blackSafety))
  };
}
