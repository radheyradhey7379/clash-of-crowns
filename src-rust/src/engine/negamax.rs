use crate::engine::hce::HceEvaluator;
use crate::engine::move_ordering::score_move;
use crate::engine::nnue::EVALUATOR as NNUE_EVALUATOR;
use crate::engine::quiescence::quiescence_search;
use shakmaty::fen::Fen;
use shakmaty::{CastlingMode, Chess, EnPassantMode, Move, MoveList, Position};
use std::time::Duration;
#[cfg(target_arch = "wasm32")]
use instant::Instant;
#[cfg(not(target_arch = "wasm32"))]
use std::time::Instant;

const MAX_DEPTH: usize = 64;

pub struct SearchOptions {
    pub max_depth: usize,
    pub max_time: Duration,
    pub error_noise_cp: i32,
    pub engine_type: String,
    pub bot_profile_id: String,
    pub recent_moves: Vec<String>,
    pub recent_fens: Vec<String>,
    pub ai_move_history: Vec<String>,
    pub full_move_history: Vec<String>,
    pub bot_tier: String,
    pub player_color: String,
    pub current_ply: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        SearchOptions {
            max_depth: 64,
            max_time: Duration::from_secs(5),
            error_noise_cp: 0,
            engine_type: "hce".to_string(),
            bot_profile_id: String::new(),
            recent_moves: Vec::new(),
            recent_fens: Vec::new(),
            ai_move_history: Vec::new(),
            full_move_history: Vec::new(),
            bot_tier: "beginner".to_string(),
            player_color: "w".to_string(),
            current_ply: 0,
        }
    }
}

pub struct SearchResult {
    pub best_move: Option<Move>,
    pub eval: i32,
    pub nodes: u64,
    pub depth: usize,
    pub noise_applied: i32,
}

fn is_reversing(m_uci: &str, prev_move: &str) -> bool {
    if m_uci.len() < 4 || prev_move.len() < 4 {
        return false;
    }
    let prev_from = &prev_move[0..2];
    let prev_to = &prev_move[2..4];
    let cand_from = &m_uci[0..2];
    let cand_to = &m_uci[2..4];
    cand_from == prev_to && cand_to == prev_from
}

fn is_same_piece(m_uci: &str, prev_move: &str, prev_prev_move: &str) -> bool {
    if m_uci.len() < 2 {
        return false;
    }
    let cand_from = &m_uci[0..2];
    if prev_move.len() >= 4 {
        let prev_to = &prev_move[2..4];
        if cand_from == prev_to {
            return true;
        }
    }
    if prev_prev_move.len() >= 4 {
        let prev_prev_to = &prev_prev_move[2..4];
        if cand_from == prev_prev_to {
            return true;
        }
    }
    false
}

fn clean_fen(fen: &str) -> String {
    fen.split_whitespace().take(4).collect::<Vec<_>>().join(" ")
}

fn simple_hash(s: &str) -> u32 {
    let mut h: u32 = 5381;
    for c in s.bytes() {
        h = (h << 5).wrapping_add(h).wrapping_add(c as u32);
    }
    h
}

fn pseudo_random_noise(error_noise_cp: i32, seed: u32) -> i32 {
    if error_noise_cp <= 0 {
        return 0;
    }
    // LCG pseudo-random generator
    let next_seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
    let val = (next_seed / 65536) % 32768;
    let range = error_noise_cp * 2;
    if range <= 0 {
        return 0;
    }
    (val as i32 % range) - error_noise_cp
}

pub fn search(pos: &Chess, options: &SearchOptions) -> SearchResult {
    let start_time = Instant::now();
    let legals = pos.legal_moves();
    if legals.is_empty() {
        return SearchResult {
            best_move: None,
            eval: 0,
            nodes: 0,
            depth: 0,
            noise_applied: 0,
        };
    }

    let mut current_pos = pos.clone();
    let hce_evaluator = HceEvaluator::new();

    // 1. Mate-in-1 Fast Path
    for m in &legals {
        let mut child_pos = current_pos.clone();
        child_pos.play_unchecked(m);
        if child_pos.is_checkmate() {
            return SearchResult {
                best_move: Some(m.clone()),
                eval: 20000,
                nodes: legals.len() as u64,
                depth: 1,
                noise_applied: 0,
            };
        }
    }

    let initial_extension_budget = 3;
    let mut moves_evals: Vec<(Move, i32, i32)> = Vec::new(); // (Move, raw_eval_with_noise, adjusted_eval_with_penalty)
    let mut total_nodes = 0;

    let mut moves_vec: Vec<_> = legals.clone().into_iter().collect();
    moves_vec.sort_by_key(|m| -score_move(&current_pos, m));

    for m in moves_vec {
        let mut child_pos = current_pos.clone();
        child_pos.play_unchecked(&m);
        let (score, _, n) = negamax(
            &mut child_pos,
            options.max_depth.saturating_sub(1),
            -i32::MAX + 1,
            i32::MAX - 1,
            start_time,
            options,
            &hce_evaluator,
            1,
            initial_extension_budget,
        );
        total_nodes += n;

        // Negamax returns the score from child's perspective, so negate it
        let eval = -score;

        // Add noise if configured
        let mut noisy_eval = eval;
        if options.error_noise_cp > 0 {
            let m_uci = m.to_uci(CastlingMode::Standard).to_string();
            let seed = simple_hash(&m_uci).wrapping_add(total_nodes as u32);
            let noise = pseudo_random_noise(options.error_noise_cp, seed);
            noisy_eval = eval + noise;
        }

        // Apply anti-repetition penalties
        let bot_id = options.bot_profile_id.to_lowercase();
        let is_beginner_learner = bot_id.contains("beginner") || bot_id.contains("learner") || bot_id.contains("core");
        let is_grandmaster = bot_id.contains("grandmaster");

        let mut penalty = 0;
        let m_uci = m.to_uci(CastlingMode::Standard).to_string();
        let len = options.recent_moves.len();

        // Penalty 1: Immediate reverse of the previous move in the game history
        if len >= 1 {
            let last_move = &options.recent_moves[len - 1];
            if is_reversing(&m_uci, last_move) {
                if is_beginner_learner {
                    penalty += 3000;
                } else if is_grandmaster {
                    penalty += 12;
                } else {
                    penalty += 800;
                }
            }
        }

        // Penalty 2: Immediate reverse of the AI's own previous move (if available)
        if len >= 2 {
            let prev_ai_move = &options.recent_moves[len - 2];
            if is_reversing(&m_uci, prev_ai_move) {
                if is_beginner_learner {
                    penalty += 2000;
                } else if is_grandmaster {
                    penalty += 10;
                } else {
                    penalty += 600;
                }
            }
        }

        // Penalty 3: Recreating a recently occurred FEN position (prevents multi-move cycles)
        if !options.recent_fens.is_empty() {
            let child_fen = clean_fen(
                &Fen::from_position(child_pos.clone(), EnPassantMode::Legal).to_string(),
            );
            for past_fen in &options.recent_fens {
                if clean_fen(past_fen) == child_fen {
                    if is_beginner_learner {
                        penalty += 2500;
                    } else if is_grandmaster {
                        penalty += 8;
                    } else {
                        penalty += 600;
                    }
                }
            }
        }

        // Penalty 4: Moving the same piece repeatedly (2-move cycle back-and-forth)
        if len >= 2 {
            let prev_move = &options.recent_moves[len - 2];
            let prev_prev_move = if len >= 4 { &options.recent_moves[len - 4] } else { "" };
            if is_same_piece(&m_uci, prev_move, prev_prev_move) {
                if is_beginner_learner {
                    penalty += 1500;
                } else if is_grandmaster {
                    penalty += 6;
                } else {
                    penalty += 400;
                }
            }
        }

        let adjusted_eval = noisy_eval - penalty;
        moves_evals.push((m.clone(), noisy_eval, adjusted_eval));
    }

    // Sort moves by adjusted evaluation descending
    moves_evals.sort_by_key(|(_, _, adjusted)| -*adjusted);

    let (best_move, best_eval) = if let Some((m, noisy, _)) = moves_evals.first() {
        (Some(m.clone()), *noisy)
    } else {
        (legals.first().cloned(), 0)
    };

    SearchResult {
        best_move,
        eval: best_eval,
        nodes: total_nodes,
        depth: options.max_depth,
        noise_applied: options.error_noise_cp,
    }
}

fn negamax(
    pos: &mut Chess,
    depth: usize,
    mut alpha: i32,
    beta: i32,
    start_time: Instant,
    options: &SearchOptions,
    hce_evaluator: &HceEvaluator,
    ply: usize,
    extension_budget: usize,
) -> (i32, Option<Move>, u64) {
    if start_time.elapsed() >= options.max_time {
        return (0, None, 0);
    }

    let legals: MoveList = pos.legal_moves();
    if legals.is_empty() {
        if pos.is_check() {
            return (-20000 + ply as i32, None, 1); // Mate
        } else {
            return (0, None, 1); // Draw / Stalemate
        }
    }

    // Rely on shakmaty's built-in game-over state (e.g., 50-move, insufficient material)
    if pos.is_game_over() {
        return (0, None, 1);
    }

    if depth == 0 {
        let mut qs_nodes = 0;
        let score = quiescence_search(
            pos,
            alpha,
            beta,
            0,
            start_time,
            options.max_time,
            &options.engine_type,
            hce_evaluator,
            &options.bot_profile_id,
            &mut qs_nodes,
        );
        return (score, None, qs_nodes);
    }

    let mut best_eval = -i32::MAX + 1;
    let mut best_move = None;
    let mut nodes = 1;

    let mut moves_vec: Vec<_> = legals.clone().into_iter().collect();
    // 2. Move Ordering
    moves_vec.sort_by_key(|m| -score_move(pos, m));

    let in_check = pos.is_check();

    for m in moves_vec {
        let mut child_pos = pos.clone();
        child_pos.play_unchecked(&m);

        // 3. Selective Extensions with budget
        let gives_check = child_pos.is_check();
        let is_promotion = m.promotion().is_some();
        let extension = if (in_check || gives_check || is_promotion) && extension_budget > 0 {
            1
        } else {
            0
        };

        let (next_depth, next_budget) = if ply < MAX_DEPTH && extension > 0 {
            (depth, extension_budget - 1)
        } else {
            (depth - 1, extension_budget)
        };

        let (eval_raw, _, child_nodes) = negamax(
            &mut child_pos,
            next_depth,
            -beta,
            -alpha,
            start_time,
            options,
            hce_evaluator,
            ply + 1,
            next_budget,
        );
        let mut eval = -eval_raw;
        nodes += child_nodes;

        // Apply low-tier bot repetition penalties at the root level (ply == 0)
        if ply == 0 {
            let bot_id = options.bot_profile_id.to_lowercase();
            let is_low_tier = bot_id.starts_with("core_")
                || bot_id.starts_with("beginner_")
                || bot_id.starts_with("learner_")
                || bot_id.contains("core")
                || bot_id.contains("beginner")
                || bot_id.contains("learner");

            if is_low_tier {
                let m_uci = m.to_uci(CastlingMode::Standard).to_string();
                let len = options.recent_moves.len();

                // Rule 1: Penalize immediate reverse of the previous AI move
                if len >= 2 {
                    let prev_move = &options.recent_moves[len - 2];
                    if is_reversing(&m_uci, prev_move) {
                        eval -= 1000;
                    }
                }

                // Rule 2: Penalize moving the same piece repeatedly in the last 2 AI turns if other legal moves exist
                let prev_move = if len >= 2 {
                    &options.recent_moves[len - 2]
                } else {
                    ""
                };
                let prev_prev_move = if len >= 4 {
                    &options.recent_moves[len - 4]
                } else {
                    ""
                };
                if is_same_piece(&m_uci, prev_move, prev_prev_move) {
                    eval -= 500;
                }

                // Rule 3: Penalize repeating a board state that occurred recently
                if options.recent_fens.len() >= 2 {
                    let clean_curr = clean_fen(
                        &Fen::from_position(child_pos.clone(), EnPassantMode::Legal).to_string(),
                    );
                    for past_fen in &options.recent_fens {
                        if clean_fen(past_fen) == clean_curr {
                            eval -= 1000;
                        }
                    }
                }
            }
        }

        if eval > best_eval {
            best_eval = eval;
            best_move = Some(m);
        }

        if eval > alpha {
            alpha = eval;
        }

        if alpha >= beta {
            break; // Beta cut-off
        }
    }

    (best_eval, best_move, nodes)
}
