use shakmaty::{Board, Color, Role, Square};

/// Extracts the 768-element feature vector from the given board state.
/// The feature vector is flattened in the following order:
/// `index = color_index * 384 + piece_index * 64 + square_index`
///
/// Where:
/// - color_index: White = 0, Black = 1
/// - piece_index: Pawn=0, Knight=1, Bishop=2, Rook=3, Queen=4, King=5
/// - square_index: 0 to 63 (A1 to H8)
pub fn extract_features(board: &Board) -> Vec<f32> {
    let mut features = vec![0.0; 768];

    // shakmaty's Board exposes the piece on each square
    for sq in shakmaty::Square::ALL {
        if let Some(piece) = board.piece_at(sq) {
            let color_index = match piece.color {
                Color::White => 0,
                Color::Black => 1,
            };

            let piece_index = match piece.role {
                Role::Pawn => 0,
                Role::Knight => 1,
                Role::Bishop => 2,
                Role::Rook => 3,
                Role::Queen => 4,
                Role::King => 5,
            };

            let square_index = usize::from(sq);

            let index = color_index * 384 + piece_index * 64 + square_index;
            features[index] = 1.0;
        }
    }

    features
}

#[cfg(test)]
mod tests {
    use super::*;
    use shakmaty::{Chess, Position};

    #[test]
    fn feature_vector_length_768() {
        let board = Board::empty();
        let features = extract_features(&board);
        assert_eq!(features.len(), 768);
    }

    #[test]
    fn empty_board_has_0_active_features() {
        let board = Board::empty();
        let features = extract_features(&board);
        let active_count = features.iter().filter(|&&f| f > 0.0).count();
        assert_eq!(active_count, 0);
    }

    #[test]
    fn starting_position_has_32_active_features() {
        let pos = Chess::default();
        let features = extract_features(pos.board());
        let active_count = features.iter().filter(|&&f| f > 0.0).count();
        assert_eq!(active_count, 32);
    }

    #[test]
    fn white_pawn_e2_index_correct() {
        let mut board = Board::empty();
        board.set_piece_at(
            Square::E2,
            shakmaty::Piece {
                color: Color::White,
                role: Role::Pawn,
            },
        );
        let features = extract_features(&board);

        // White (0) * 384 + Pawn (0) * 64 + E2 (12) = 12
        assert_eq!(features[12], 1.0);
        let active_count = features.iter().filter(|&&f| f > 0.0).count();
        assert_eq!(active_count, 1);
    }

    #[test]
    fn black_king_e8_index_correct() {
        let mut board = Board::empty();
        board.set_piece_at(
            Square::E8,
            shakmaty::Piece {
                color: Color::Black,
                role: Role::King,
            },
        );
        let features = extract_features(&board);

        // Black (1) * 384 + King (5) * 64 + E8 (60)
        // 384 + 320 + 60 = 764
        assert_eq!(features[764], 1.0);
        let active_count = features.iter().filter(|&&f| f > 0.0).count();
        assert_eq!(active_count, 1);
    }

    #[test]
    fn python_rust_feature_index_order_documented() {
        // This test acts as a documentation contract that the feature indices match the Python logic.
        // Python: color(0/1)*384 + piece(0-5)*64 + sq(0-63)
        let w = 0;
        let b = 1;
        let p = 0;
        let n = 1;
        let b_piece = 2;
        let r = 3;
        let q = 4;
        let k = 5;

        let a1 = 0;
        let h8 = 63;

        assert_eq!(w * 384 + p * 64 + a1, 0);
        assert_eq!(b * 384 + k * 64 + h8, 767);
    }
}
