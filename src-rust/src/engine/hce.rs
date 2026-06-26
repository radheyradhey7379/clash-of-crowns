use crate::engine::pst::{BISHOP_PST, KNIGHT_PST, PAWN_PST};
use shakmaty::{Board, Color, Role, Square};

pub struct HceEvaluator;

impl HceEvaluator {
    pub fn new() -> Self {
        Self
    }

    pub fn evaluate(&self, board: &Board, turn: Color) -> i32 {
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

                let idx = if piece.color == Color::White {
                    sq.file() as usize + (7 - sq.rank() as usize) * 8
                } else {
                    sq.file() as usize + (sq.rank() as usize) * 8
                };

                let pst_val = match piece.role {
                    Role::Pawn => PAWN_PST[idx],
                    Role::Knight => KNIGHT_PST[idx],
                    Role::Bishop => BISHOP_PST[idx],
                    _ => 0,
                };

                val += pst_val;

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
