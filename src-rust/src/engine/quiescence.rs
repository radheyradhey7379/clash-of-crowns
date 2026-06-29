use crate::engine::hce::HceEvaluator;
use crate::engine::move_ordering::score_move;
use crate::engine::nnue::EVALUATOR as NNUE_EVALUATOR;
use shakmaty::{Chess, Position};
use std::time::{Duration, Instant};

const MAX_QS_DEPTH: usize = 6;

pub fn quiescence_search(
    pos: &mut Chess,
    mut alpha: i32,
    beta: i32,
    qs_depth: usize,
    start_time: Instant,
    max_time: Duration,
    engine_type: &str,
    hce_evaluator: &HceEvaluator,
    bot_profile_id: &str,
    nodes: &mut u64,
) -> i32 {
    *nodes += 1;

    if start_time.elapsed() >= max_time {
        return alpha;
    }

    let use_all_pst = bot_profile_id.starts_with("learner_") || bot_profile_id.contains("learner");
    let stand_pat = if engine_type == "hce" {
        hce_evaluator.evaluate(pos.board(), pos.turn(), use_all_pst)
    } else {
        NNUE_EVALUATOR.evaluate(pos.board(), pos.turn())
    };

    if stand_pat >= beta {
        return beta;
    }

    if alpha < stand_pat {
        alpha = stand_pat;
    }

    if qs_depth >= MAX_QS_DEPTH || pos.is_game_over() {
        return alpha;
    }

    let legals = pos.legal_moves();

    // Generate forcing moves: captures and promotions.
    let mut forcing_moves: Vec<_> = legals
        .into_iter()
        .filter(|m| m.is_capture() || m.promotion().is_some())
        .collect();

    // Order forcing moves
    forcing_moves.sort_by_key(|m| -score_move(pos, m));

    for m in forcing_moves {
        let mut child_pos = pos.clone();
        child_pos.play_unchecked(&m);

        let score = -quiescence_search(
            &mut child_pos,
            -beta,
            -alpha,
            qs_depth + 1,
            start_time,
            max_time,
            engine_type,
            hce_evaluator,
            bot_profile_id,
            nodes,
        );

        if score >= beta {
            return beta;
        }
        if score > alpha {
            alpha = score;
        }
    }

    alpha
}
