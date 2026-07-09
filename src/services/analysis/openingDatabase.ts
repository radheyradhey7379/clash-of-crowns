import { OpeningInfo } from './analysisTypes';

interface OpeningDbEntry {
  eco: string;
  name: string;
  description: string;
  fen: string; // Normalized FEN (first 4 fields)
}

// Normalized FENs of major chess openings (first 4 fields: board, turn, castling, enpassant)
const OPENING_DATABASE: OpeningDbEntry[] = [
  {
    eco: 'C51',
    name: 'Evans Gambit',
    description: 'White sacrifices a pawn on b4 to construct a strong center and open lines for attack.',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq'
  },
  {
    eco: 'C50',
    name: 'Italian Game',
    description: 'One of the oldest openings, aiming to control the center with e4, Nf3, and Bc4.',
    fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq'
  },
  {
    eco: 'C60',
    name: 'Ruy Lopez (Spanish Opening)',
    description: 'White plays Bc5 to put pressure on the Nc6 knight which controls the e5 pawn.',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq'
  },
  {
    eco: 'B20',
    name: 'Sicilian Defense',
    description: 'The most popular defense against 1.e4, fighting for control of the d4 square asymmetrical.',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'B30',
    name: 'Sicilian Defense: Old Sicilian',
    description: 'Black plays Nc6, waiting to see White\'s plan before committing the d/e pawns.',
    fen: 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq'
  },
  {
    eco: 'B90',
    name: 'Sicilian Defense: Najdorf Variation',
    description: 'One of the sharpest openings in chess, made famous by Fischer and Kasparov.',
    fen: 'r1bqkb1r/pp3ppp/2nppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq'
  },
  {
    eco: 'C00',
    name: 'French Defense',
    description: 'A solid, closed opening where Black combats e4 with e6, leading to central tension.',
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'B10',
    name: 'Caro-Kann Defense',
    description: 'A highly resilient defense against 1.e4, preparing d5 with c6 to maintain a solid pawn structure.',
    fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'D06',
    name: 'Queen\'s Gambit',
    description: 'White offers a flank pawn on c4 to gain control of the center and create active piece play.',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq'
  },
  {
    eco: 'D30',
    name: 'Queen\'s Gambit Declined',
    description: 'Black rejects the gambit pawn to maintain a strong pawn presence in the center on d5.',
    fen: 'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'D02',
    name: 'London System',
    description: 'A solid system for White with Bf4, playable against almost any Black setup.',
    fen: 'rnbqkbnr/pppppppp/8/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq'
  },
  {
    eco: 'A10',
    name: 'English Opening',
    description: 'White fights for the d5 square from the flank, aiming for a hypermodern strategy.',
    fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq'
  },
  {
    eco: 'A04',
    name: 'Réti Opening',
    description: 'A hypermodern opening starting with Nf3, preparing to control the center from the wings.',
    fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq'
  },
  {
    eco: 'A80',
    name: 'Dutch Defense',
    description: 'An aggressive defense where Black seeks active play and control of the e4 square.',
    fen: 'rnbqkbnr/pppppppp/8/5y2/3P4/8/PPP1PPPP/RNBQKBNR b KQkq' // Note: standard dutch fen below:
  },
  {
    eco: 'A80',
    name: 'Dutch Defense',
    description: 'Black fights for the e4 square with f5, setting up an aggressive kingside attack.',
    fen: 'rnbqkbnr/pppppppp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'C44',
    name: 'Scotch Game',
    description: 'White immediately attacks the center with d4, opening up files for bishops.',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq'
  },
  {
    eco: 'C30',
    name: 'King\'s Gambit',
    description: 'A romantic chess opening where White offers the f4 pawn for quick development.',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq'
  },
  {
    eco: 'C25',
    name: 'Vienna Game',
    description: 'White plays Nc3 to control the center and keep options open for f4 plans.',
    fen: 'rnbqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq'
  },
  {
    eco: 'B01',
    name: 'Scandinavian Defense',
    description: 'Black challenges the e4 pawn immediately, forcing open lines and early queen moves.',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'B07',
    name: 'Pirc Defense',
    description: 'A hypermodern defense where Black allows White a broad pawn center to counter-attack it later.',
    fen: 'rnbqkbnr/ppp1pp1p/3p2p1/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'E60',
    name: 'King\'s Indian Defense',
    description: 'A dynamic, hypermodern defense where Black fianchettos the kingside bishop.',
    fen: 'rnbqkbnr/pppppp1p/6p1/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq'
  },
  {
    eco: 'E12',
    name: 'Queen\'s Indian Defense',
    description: 'A hypermodern defense against d4, utilizing the light-squared bishop on b7.',
    fen: 'rnbqkbnr/p1pppppp/1p6/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq'
  },
  {
    eco: 'E20',
    name: 'Nimzo-Indian Defense',
    description: 'Black pins the Nc3 knight to restrict White\'s e4 pawn push plans.',
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/3P4/2N5/PPP1PPPP/R1BQKBNR b KQkq'
  },
  {
    eco: 'D70',
    name: 'Grünfeld Defense',
    description: 'Black challenges White\'s center immediately with d5 after Nf6 and g6.',
    fen: 'rnbqkbnr/ppp1pp1p/6p1/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq'
  },
  {
    eco: 'B02',
    name: 'Alekhine\'s Defense',
    description: 'Black provokes White\'s pawns forward, intending to undermine them later.',
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq'
  }
];

/**
 * Normalizes a FEN string by extracting only the first 4 fields (board, active color, castling, en passant target).
 * This filters out the move counters which change on every move.
 */
function normalizeFen(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.slice(0, 4).join(' ');
}

/**
 * Detects the chess opening based on the sequence of FEN positions in the game.
 * Traverses the moves backwards to find the longest matching opening.
 */
export function detectOpening(fens: string[]): OpeningInfo | null {
  if (!fens || fens.length === 0) return null;

  // Search backwards so we find the deepest matched opening
  for (let i = Math.min(fens.length - 1, 20); i >= 0; i--) {
    const normalized = normalizeFen(fens[i]);
    const match = OPENING_DATABASE.find(entry => normalizeFen(entry.fen) === normalized || normalized.startsWith(normalizeFen(entry.fen)));
    if (match) {
      return {
        eco: match.eco,
        name: match.name,
        description: match.description
      };
    }
  }

  // Fallback: If no opening detected but game has started, return basic info
  if (fens.length > 1) {
    return {
      eco: 'A00',
      name: 'Open Game / Custom Opening',
      description: 'The game has transposed into a custom opening line or unstructured position.'
    };
  }

  return null;
}
