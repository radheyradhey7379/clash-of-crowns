export interface LessonContent {
  id: string;
  title: string;
  section: string;
  description: string;
  rules: string[];
  fen: string;
  demoMoves?: string[];
  puzzleMoves?: string[];
  puzzleInstructions?: string;
  requiredPieceSquare?: string;
}

export const LESSON_DATA: Record<string, LessonContent> = {
  "PAWN": {
    id: "PAWN",
    title: "The Pawn",
    section: "THE CHESS PIECES",
    description: "The foot soldier of the army. Weak individually, but powerful in numbers.",
    rules: [
      "Moves forward one square at a time.",
      "On its first move, it can move forward two squares.",
      "Captures diagonally forward one square.",
      "Cannot move backward or capture forward.",
      "Can be promoted if it reaches the other side."
    ],
    fen: "k7/8/8/8/8/4P3/8/7K w - - 0 1",
    demoMoves: ["e4"],
    puzzleMoves: ["e4"],
    puzzleInstructions: "Move the White Pawn to e4.",
    requiredPieceSquare: "e3"
  },
  "KNIGHT": {
    id: "KNIGHT",
    title: "The Knight",
    section: "THE CHESS PIECES",
    description: "The only piece that can jump over others. Moves in a mysterious L-shape.",
    rules: [
      "Moves in an 'L' shape: two squares in one direction, then one square perpendicular.",
      "Can jump over any piece in its path.",
      "Always lands on a square of a different color than it started on.",
      "Excellent for 'forking' multiple enemy pieces at once."
    ],
    fen: "6k1/8/3r4/8/4N3/8/8/7K w - - 0 1",
    demoMoves: ["Nf6+"],
    puzzleMoves: ["Nf6+"],
    puzzleInstructions: "Move the Knight to f6 to deliver a check!",
    requiredPieceSquare: "e4"
  },
  "BISHOP": {
    id: "BISHOP",
    title: "The Bishop",
    section: "THE CHESS PIECES",
    description: "The long-range sniper. It dominates the diagonals.",
    rules: [
      "Moves any number of squares diagonally.",
      "Stays on the same color square for the entire game.",
      "You start with one light-squared and one dark-squared bishop.",
      "Cannot jump over other pieces."
    ],
    fen: "r6k/8/8/8/4B3/8/8/7K w - - 0 1",
    demoMoves: ["Bxa8"],
    puzzleMoves: ["Bxa8"],
    puzzleInstructions: "Capture the Black Rook on a8 with your Bishop.",
    requiredPieceSquare: "e4"
  },
  "ROOK": {
    id: "ROOK",
    title: "The Rook",
    section: "THE CHESS PIECES",
    description: "The heavy artillery. Powerful in the endgame and for controlling files.",
    rules: [
      "Moves any number of squares horizontally or vertically.",
      "Powerful when placed on open files.",
      "Used in the special move called 'Castling'.",
      "Cannot jump over other pieces."
    ],
    fen: "7k/8/8/8/4R3/8/8/7K w - - 0 1",
    demoMoves: ["Re8+"],
    puzzleMoves: ["Re8+"],
    puzzleInstructions: "Move the Rook to e8 to check the Black King.",
    requiredPieceSquare: "e4"
  },
  "QUEEN": {
    id: "QUEEN",
    title: "The Queen",
    section: "THE CHESS PIECES",
    description: "The most powerful piece on the board. Combines the powers of Rook and Bishop.",
    rules: [
      "Moves any number of squares horizontally, vertically, or diagonally.",
      "The ultimate offensive weapon.",
      "Protect your Queen at all costs, but don't be afraid to use her power.",
      "Cannot jump over other pieces."
    ],
    fen: "q6k/8/8/8/4Q3/8/8/7K w - - 0 1",
    demoMoves: ["Qxa8+"],
    puzzleMoves: ["Qxa8+"],
    puzzleInstructions: "Capture the Black Queen on a8.",
    requiredPieceSquare: "e4"
  },
  "KING": {
    id: "KING",
    title: "The King",
    section: "THE CHESS PIECES",
    description: "The most important piece. If the King falls, the game is lost.",
    rules: [
      "Moves one square in any direction.",
      "Must be protected at all times.",
      "Cannot move into a square where it would be in 'Check'.",
      "The game ends when the King is in 'Checkmate'."
    ],
    fen: "k7/8/8/8/4K3/8/8/8 w - - 0 1",
    demoMoves: ["Ke5"],
    puzzleMoves: ["Ke5"],
    puzzleInstructions: "Move your King to e5.",
    requiredPieceSquare: "e4"
  },
  "CHESS NOTATION": {
    id: "CHESS NOTATION",
    title: "Chess Notation",
    section: "BASIC COMBAT",
    description: "The language of chess. Every square has a name.",
    rules: [
      "Files are columns labeled 'a' through 'h'.",
      "Ranks are rows labeled '1' through '8'.",
      "A square is named by its file and rank (e.g., 'e4').",
      "Pieces are capitalized: K (King), Q (Queen), R (Rook), B (Bishop), N (Knight).",
      "Pawns have no letter (e.g., 'e4' means pawn to e4)."
    ],
    fen: "k7/8/8/8/4B3/8/8/7K w - - 0 1",
    demoMoves: ["Bf5"],
    puzzleMoves: ["Bf5"],
    puzzleInstructions: "Move the Bishop to f5.",
    requiredPieceSquare: "e4"
  },
  "CAPTURING": {
    id: "CAPTURING",
    title: "Capturing",
    section: "BASIC COMBAT",
    description: "Removing enemy pieces from the board.",
    rules: [
      "A piece is captured by moving onto its square.",
      "The captured piece is removed from the board.",
      "You cannot capture your own pieces.",
      "Capturing is usually optional, unless it's the only way out of check."
    ],
    fen: "k7/8/8/5p2/4B3/8/8/7K w - - 0 1",
    demoMoves: ["Bxf5"],
    puzzleMoves: ["Bxf5"],
    puzzleInstructions: "Capture the Black Pawn on f5 using your Bishop.",
    requiredPieceSquare: "e4"
  },
  "CHECK": {
    id: "CHECK",
    title: "Check",
    section: "BASIC COMBAT",
    description: "A direct attack on the King.",
    rules: [
      "When a King is under attack, it is in 'Check'.",
      "You must immediately move out of check, block it, or capture the attacker.",
      "You cannot make a move that leaves your King in check.",
      "It is polite (but not required) to say 'Check' in casual play."
    ],
    fen: "k7/8/8/8/4R3/8/8/7K w - - 0 1",
    demoMoves: ["Re8+"],
    puzzleMoves: ["Re8+"],
    puzzleInstructions: "Deliver a check by moving your Rook to e8.",
    requiredPieceSquare: "e4"
  },
  "OUT OF CHECK": {
    id: "OUT OF CHECK",
    title: "Out of Check",
    section: "BASIC COMBAT",
    description: "Escaping the threat to your King.",
    rules: [
      "Move the King to a safe square.",
      "Block the check with another piece (not possible against Knights).",
      "Capture the piece that is giving the check.",
      "If none of these are possible, it is Checkmate."
    ],
    fen: "k7/8/8/8/r3K3/8/8/8 w - - 0 1",
    demoMoves: ["Kf3"],
    puzzleMoves: ["Kf3"],
    puzzleInstructions: "Move your King to f3 to get out of check.",
    requiredPieceSquare: "e4"
  },
  "CHECKMATE": {
    id: "CHECKMATE",
    title: "Checkmate",
    section: "MATCH RESOLUTION",
    description: "The end of the game. The King has no escape.",
    rules: [
      "The King is in check and has no legal way to escape.",
      "The player who delivers checkmate wins the game.",
      "Checkmate can happen very quickly (Scholar's Mate) or after a long battle.",
      "Once checkmate is delivered, the game stops immediately."
    ],
    fen: "7k/6R1/8/8/8/8/8/1Q5K w - - 0 1",
    demoMoves: ["Qb8#"],
    puzzleMoves: ["Qb8#"],
    puzzleInstructions: "Deliver checkmate by moving your Queen to b8.",
    requiredPieceSquare: "b1"
  },
  "STALEMATE": {
    id: "STALEMATE",
    title: "Stalemate",
    section: "MATCH RESOLUTION",
    description: "A draw where no one wins.",
    rules: [
      "It is a player's turn to move, but they have no legal moves.",
      "The King is NOT in check.",
      "The game ends in a draw (1/2 - 1/2).",
      "Be careful when winning to avoid accidentally stalemating your opponent!"
    ],
    fen: "7k/4Q3/8/8/8/8/8/7K w - - 0 1",
    demoMoves: ["Qf7"],
    puzzleMoves: ["Qf7"],
    puzzleInstructions: "Deliver stalemate (draw) by moving your Queen to f7.",
    requiredPieceSquare: "e7"
  },
  "PROMOTION": {
    id: "PROMOTION",
    title: "Promotion",
    section: "MATCH RESOLUTION",
    description: "A pawn's ultimate reward.",
    rules: [
      "When a pawn reaches the 8th rank (or 1st for black), it MUST be promoted.",
      "It can become a Queen, Rook, Bishop, or Knight.",
      "Most players choose a Queen (the most powerful).",
      "You can have multiple Queens on the board through promotion."
    ],
    fen: "8/P7/k7/8/8/8/8/7K w - - 0 1",
    demoMoves: ["a8=Q"],
    puzzleMoves: ["a8=Q"],
    puzzleInstructions: "Promote your Pawn to a Queen on a8.",
    requiredPieceSquare: "a7"
  },
  "CASTLING K-SIDE": {
    id: "CASTLING K-SIDE",
    title: "Castling King-Side",
    section: "SPECIAL MANEUVERS",
    description: "A special move to protect the King and activate the Rook.",
    rules: [
      "The King moves two squares toward the Rook.",
      "The Rook jumps over the King to the square next to it.",
      "Neither piece must have moved before.",
      "The path must be clear, and the King cannot be in check or pass through check."
    ],
    fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    demoMoves: ["O-O"],
    puzzleMoves: ["O-O"],
    puzzleInstructions: "Castle King-side by moving your King to g1.",
    requiredPieceSquare: "e1"
  },
  "CASTLING Q-SIDE": {
    id: "CASTLING Q-SIDE",
    title: "Castling Queen-Side",
    section: "SPECIAL MANEUVERS",
    description: "Castling on the long side of the board.",
    rules: [
      "Similar to King-side castling, but on the Queen's side.",
      "The King moves two squares toward the Rook (to c1 or c8).",
      "The Rook jumps over the King to d1 or d8.",
      "Often used to create asymmetrical positions and aggressive attacks."
    ],
    fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    demoMoves: ["O-O-O"],
    puzzleMoves: ["O-O-O"],
    puzzleInstructions: "Castle Queen-side by moving your King to c1.",
    requiredPieceSquare: "e1"
  },
  "EN PASSANT": {
    id: "EN PASSANT",
    title: "En Passant",
    section: "SPECIAL MANEUVERS",
    description: "The most misunderstood rule in chess.",
    rules: [
      "A special pawn capture that can only occur immediately after a pawn moves two squares.",
      "If an enemy pawn lands next to yours after its double-step, you can capture it 'in passing'.",
      "You move your pawn diagonally forward as if the enemy pawn had only moved one square.",
      "This move MUST be made immediately on the next turn."
    ],
    fen: "k7/8/8/3pP3/8/8/8/7K w - d6 0 1",
    demoMoves: ["exd6"],
    puzzleMoves: ["exd6"],
    puzzleInstructions: "Capture the Black Pawn en passant by moving your Pawn to d6.",
    requiredPieceSquare: "e5"
  }
};
