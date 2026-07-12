use crate::engine::pst::{BISHOP_PST, KING_PST, KNIGHT_PST, PAWN_PST, QUEEN_PST, ROOK_PST};
use shakmaty::{Board, Color, Role, Square};

#[derive(Clone, serde::Serialize, Default)]
pub struct HceDetailedScore {
    pub material_score: i32,
    pub pst_score: i32,
    pub pst_mode: String,
    pub used_piece_tables: Vec<String>,
    pub ignored_piece_tables: Vec<String>,
    pub final_hce_eval: i32,
}

pub struct HceEvaluator;

impl HceEvaluator {
    pub fn new() -> Self {
        Self
    }

    pub fn evaluate(&self, board: &Board, turn: Color, use_all_pst: bool) -> i32 {
        self.evaluate_detailed(board, turn, use_all_pst).final_hce_eval
    }

    pub fn evaluate_detailed(&self, board: &Board, turn: Color, use_all_pst: bool) -> HceDetailedScore {
        let mut material_score = 0;
        let mut pst_score = 0;
        let mut used_piece_tables = vec!["Pawn".to_string(), "Knight".to_string(), "Bishop".to_string()];
        let mut ignored_piece_tables = Vec::new();

        if use_all_pst {
            used_piece_tables.push("Rook".to_string());
            used_piece_tables.push("Queen".to_string());
            used_piece_tables.push("King".to_string());
        } else {
            ignored_piece_tables.push("Rook".to_string());
            ignored_piece_tables.push("Queen".to_string());
            ignored_piece_tables.push("King".to_string());
        }

        for sq in Square::ALL {
            if let Some(piece) = board.piece_at(sq) {
                let material_val = match piece.role {
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
                    Role::Rook => {
                        if use_all_pst {
                            ROOK_PST[idx]
                        } else {
                            0
                        }
                    }
                    Role::Queen => {
                        if use_all_pst {
                            QUEEN_PST[idx]
                        } else {
                            0
                        }
                    }
                    Role::King => {
                        if use_all_pst {
                            KING_PST[idx]
                        } else {
                            0
                        }
                    }
                };

                if piece.color == turn {
                    material_score += material_val;
                    pst_score += pst_val;
                } else {
                    material_score -= material_val;
                    pst_score -= pst_val;
                }
            }
        }

        HceDetailedScore {
            material_score,
            pst_score,
            pst_mode: if use_all_pst { "full".to_string() } else { "limited".to_string() },
            used_piece_tables,
            ignored_piece_tables,
            final_hce_eval: material_score + pst_score,
        }
    }
}
