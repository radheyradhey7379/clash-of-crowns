pub mod features;
pub mod model;
pub mod weights;

use self::model::NnueModel;
use shakmaty::{Board, Color, Role, Square};

// A very simple placeholder for a 768->256->32->1 NNUE architecture.
// NEEDS_REAL_WEIGHTS
// PLACEHOLDER_ONLY
// DO_NOT_CALL_FINAL_STRENGTH
// In a real application, these weights would be loaded from a file.
// For now, we will just use a hardcoded evaluation that mimics NNUE structure.

const HIDDEN1_SIZE: usize = 256;
const HIDDEN2_SIZE: usize = 32;

pub struct NnueEvaluator {
    pub model: NnueModel,
}

impl NnueEvaluator {
    pub fn new() -> Self {
        Self {
            model: NnueModel::load(),
        }
    }

    pub fn evaluate(&self, board: &Board, turn: Color) -> i32 {
        if let Some(eval) = self.model.forward(&features::extract_features(board)) {
            // The NNUE outputs an evaluation from White's perspective.
            // If it's Black's turn, we must negate it because negamax expects scores relative to the side to move.
            let score = if turn == Color::White { eval } else { -eval };
            return score;
        }

        // Fallback to basic material + heuristic evaluation since we don't have real weights.
        let mut score = 0;

        for sq in Square::ALL {
            if let Some(piece) = board.piece_at(sq) {
                let mut val = match piece.role {
                    Role::Pawn => 100,
                    Role::Knight => 320,
                    Role::Bishop => 330,
                    Role::Rook => 500,
                    Role::Queen => 900,
                    Role::King => 20000,
                };

                // Extremely basic PST (center control)
                let file = sq.file() as i32;
                let rank = sq.rank() as i32;
                let center_dist =
                    (file - 3).abs().min((file - 4).abs()) + (rank - 3).abs().min((rank - 4).abs());

                if piece.role == Role::Knight || piece.role == Role::Pawn {
                    val -= center_dist * 10;
                }

                if piece.role == Role::King {
                    // Basic King safety: prefer corners in middlegame, but this is just a stub
                    val -= (7 - center_dist) * 5;
                }

                if piece.color == turn {
                    score += val;
                } else {
                    score -= val;
                }
            }
        }

        score
    }
}

// Global evaluator instance
lazy_static::lazy_static! {
    pub static ref EVALUATOR: NnueEvaluator = NnueEvaluator::new();
}
