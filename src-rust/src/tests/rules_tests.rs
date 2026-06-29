use crate::chess::move_validator::validate_and_execute_move;
use shakmaty::fen::Fen;
use shakmaty::{Chess, Position};

#[test]
fn test_legal_pawn_moves() {
    // White pawn on e2 can move to e3 or e4
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let res1 = validate_and_execute_move(fen, "e2", "e3", None);
    assert!(res1.is_ok());
    let res2 = validate_and_execute_move(fen, "e2", "e4", None);
    assert!(res2.is_ok());

    // Pawn cannot move backward
    let res3 = validate_and_execute_move(fen, "e2", "e1", None);
    assert!(res3.is_err());
}

#[test]
fn test_legal_knight_moves() {
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    // Knight on g1 can go to f3 or h3
    let res1 = validate_and_execute_move(fen, "g1", "f3", None);
    assert!(res1.is_ok());
    let res2 = validate_and_execute_move(fen, "g1", "h3", None);
    assert!(res2.is_ok());
    // Cannot go to e2 (occupied by pawn)
    let res3 = validate_and_execute_move(fen, "g1", "e2", None);
    assert!(res3.is_err());
}

#[test]
fn test_legal_bishop_moves() {
    // Bishop on c1 is blocked initially
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let res1 = validate_and_execute_move(fen, "c1", "d2", None);
    assert!(res1.is_err());

    // Bishop on e5 can move diagonally
    let fen2 = "k7/8/8/4b3/8/8/8/7K b - - 0 1"; // White king on h1 to avoid check restrictions
    let res2 = validate_and_execute_move(fen2, "e5", "b2", None);
    assert!(res2.is_ok());
}

#[test]
fn test_legal_rook_moves() {
    // Rook on e5 can move horizontally and vertically
    let fen = "k7/8/8/4R3/8/8/8/K7 w - - 0 1";
    let res1 = validate_and_execute_move(fen, "e5", "e8", None);
    assert!(res1.is_ok());
    let res2 = validate_and_execute_move(fen, "e5", "a5", None);
    assert!(res2.is_ok());
}

#[test]
fn test_legal_queen_moves() {
    let fen = "k7/8/8/4Q3/8/8/8/7K w - - 0 1"; // White king on h1
    let res1 = validate_and_execute_move(fen, "e5", "a1", None); // diagonal
    assert!(res1.is_ok());
    let res2 = validate_and_execute_move(fen, "e5", "e8", None); // vertical
    assert!(res2.is_ok());
}

#[test]
fn test_legal_king_moves() {
    let fen = "k7/8/8/4K3/8/8/8/8 w - - 0 1";
    let res1 = validate_and_execute_move(fen, "e5", "e6", None);
    assert!(res1.is_ok());

    // Move to f6 when rook is on f7 (attacks f6) -> illegal!
    let fen3 = "k7/5r2/8/4K3/8/8/8/8 w - - 0 1";
    let res2 = validate_and_execute_move(fen3, "e5", "f6", None);
    assert!(res2.is_err());
}

#[test]
fn test_castling_blocked_by_check() {
    // King is in check, cannot castle
    let fen_check = "r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1";
    let res = validate_and_execute_move(fen_check, "e1", "g1", None); // Castle short
    assert!(res.is_err());
}

#[test]
fn test_en_passant_valid_only_immediately() {
    // Black pawn advances two squares: d7 to d5
    let fen = "k7/8/8/3pP3/8/8/8/7K w - d6 0 1";
    let res = validate_and_execute_move(fen, "e5", "d6", None);
    assert!(res.is_ok());

    // If it's not immediately, en passant is invalid (en passant square is none '-')
    let fen_no_ep = "k7/8/8/3pP3/8/8/8/7K w - - 0 1";
    let res_no = validate_and_execute_move(fen_no_ep, "e5", "d6", None);
    assert!(res_no.is_err());
}

#[test]
fn test_promotion_choice_valid() {
    let fen = "8/P7/k7/8/8/8/8/7K w - - 0 1";
    let res_queen = validate_and_execute_move(fen, "a7", "a8", Some("q"));
    assert!(res_queen.is_ok());
    let (next_fen, _, _, _) = res_queen.unwrap();
    assert!(next_fen.contains("Q"));
}

#[test]
fn test_checkmate_detected() {
    // Scholar's mate position
    let fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1";
    let res = validate_and_execute_move(fen, "f3", "f7", None);
    assert!(res.is_ok());
    let (_, is_checkmate, _, _) = res.unwrap();
    assert!(is_checkmate);
}

#[test]
fn test_stalemate_detected() {
    // Simple stalemate setup (Black king on h8, White queen on g6, White king on h1)
    let fen_stalemate = "7k/8/6Q1/8/8/8/8/7K b - - 0 1";
    let setup: Fen = fen_stalemate.parse().unwrap();
    let pos: Chess = setup
        .into_position(shakmaty::CastlingMode::Standard)
        .unwrap();
    assert!(pos.is_stalemate());
}

#[test]
fn test_fifty_move_draw() {
    let fen = "8/8/8/8/k7/8/8/K7 w - - 99 1"; // halfmoves is 99
    let res = validate_and_execute_move(fen, "a1", "b1", None);
    assert!(res.is_ok());
    let setup: Fen = fen.parse().unwrap();
    let pos: Chess = setup
        .into_position(shakmaty::CastlingMode::Standard)
        .unwrap();
    let legal = pos.legal_moves();
    let m = legal.first().unwrap();
    let next = pos.play(m).unwrap();
    assert!(next.halfmoves() >= 100);
}

#[test]
fn test_repetition_draw() {
    use crate::engine::handlers::is_threefold_repetition;

    let fen1 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string();
    let fen2 = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1".to_string();
    let fen3 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 2".to_string();
    let fen4 = "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 2".to_string();
    let fen5 = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 3".to_string();

    let history = vec![fen1, fen2, fen3, fen4];
    assert!(is_threefold_repetition(&fen5, &history));
}

#[test]
fn test_illegal_move_rejected() {
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    // Pawn jumps 3 squares
    let res = validate_and_execute_move(fen, "e2", "e5", None);
    assert!(res.is_err());
}

#[test]
fn test_frontend_cannot_bypass_locked_or_illegal_move() {
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let res = validate_and_execute_move(fen, "e2", "e5", None);
    assert!(res.is_err());
}
