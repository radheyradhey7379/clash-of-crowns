use crate::engine::negamax::{search, SearchOptions};
use shakmaty::fen::Fen;
use shakmaty::{CastlingMode, Chess, Position};
use std::str::FromStr;
use std::time::Duration;

/// Run a quick benchmark on a specific FEN.
pub fn run_benchmark_on_fen(fen: &str) {
    let setup = Fen::from_str(fen).unwrap_or_else(|_| Fen::default());
    let pos: Chess = setup
        .into_position(CastlingMode::Standard)
        .unwrap_or_else(|_| Chess::default());

    let hce_options = SearchOptions {
        max_depth: 4,
        max_time: Duration::from_millis(5000),
        error_noise_cp: 0,
        engine_type: "hce".to_string(),
        bot_profile_id: String::new(),
        recent_moves: Vec::new(),
        recent_fens: Vec::new(),
    };

    let nnue_options = SearchOptions {
        max_depth: 4,
        max_time: Duration::from_millis(5000),
        error_noise_cp: 0,
        engine_type: "nnue".to_string(),
        bot_profile_id: String::new(),
        recent_moves: Vec::new(),
        recent_fens: Vec::new(),
    };

    println!("Benchmarking FEN: {}", fen);

    let start_hce = std::time::Instant::now();
    let hce_res = search(&pos, &hce_options);
    let dur_hce = start_hce.elapsed();
    println!(
        "  HCE  | Eval: {:>5} | Move: {:?} | Time: {:?}",
        hce_res.eval,
        hce_res
            .best_move
            .map(|m| m.to_uci(CastlingMode::Standard).to_string()),
        dur_hce
    );

    let start_nnue = std::time::Instant::now();
    let nnue_res = search(&pos, &nnue_options);
    let dur_nnue = start_nnue.elapsed();
    println!(
        "  NNUE | Eval: {:>5} | Move: {:?} | Time: {:?}",
        nnue_res.eval,
        nnue_res
            .best_move
            .map(|m| m.to_uci(CastlingMode::Standard).to_string()),
        dur_nnue
    );

    println!("---------------------------------------------------");
}
