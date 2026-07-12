use crate::engine::hce::HceEvaluator;
use crate::engine::move_ordering::score_move;
use crate::engine::nnue::EVALUATOR as NNUE_EVALUATOR;
use crate::engine::quiescence::quiescence_search;
#[cfg(target_arch = "wasm32")]
use instant::Instant;
use shakmaty::fen::Fen;
use shakmaty::{CastlingMode, Chess, EnPassantMode, Move, MoveList, Position};
use std::time::Duration;
#[cfg(not(target_arch = "wasm32"))]
use std::time::Instant;

const MAX_DEPTH: usize = 64;

#[derive(Clone)]
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

#[derive(Clone, serde::Serialize, Default)]
pub struct SearchDebugStats {
    pub depth_target: u32,
    pub depth_reached: u32,
    pub depth_sequence: Vec<u32>,
    pub nodes_visited: u64,
    pub alpha_beta_cutoffs: u64,
    pub beta_cutoffs: u64,
    pub quiescence_nodes: u64,
    pub quiescence_depth_max: u32,
    pub move_ordering_used: bool,
    pub stopped_by_timeout: bool,
    pub returned_best_so_far: bool,
    pub actual_time_ms: u64,
}

pub struct SearchContext {
    pub nodes_visited: u64,
    pub alpha_beta_cutoffs: u64,
    pub beta_cutoffs: u64,
    pub quiescence_nodes: u64,
    pub quiescence_depth_max: u32,
}

#[derive(Clone, serde::Serialize, Default)]
pub struct NnueDebugInfo {
    pub model_loaded: bool,
    pub weights_source: String,
    pub weights_hash: String,
    pub input_features_count: u32,
    pub forward_pass_used: bool,
    pub activation_type: String,
    pub quantization_type: String,
    pub raw_nnue_eval: i32,
    pub final_nnue_eval: i32,
}

#[derive(Clone, serde::Serialize, Default)]
pub struct RandomErrorDebugInfo {
    pub raw_eval: i32,
    pub random_factor: f32,
    pub bot_impairment_scale: f32,
    pub random_error_cp_applied: i32,
    pub final_eval: i32,
    pub formula_used: String,
    pub applied_once: bool,
}

#[derive(Clone)]
pub struct SearchResult {
    pub best_move: Option<Move>,
    pub eval: i32,
    pub nodes: u64,
    pub depth: usize,
    pub noise_applied: i32,
    pub debug_stats: SearchDebugStats,
    pub hce_debug_info: Option<crate::engine::hce::HceDetailedScore>,
    pub nnue_debug_info: Option<NnueDebugInfo>,
    pub random_error_debug_info: Option<RandomErrorDebugInfo>,
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

pub fn search_at_depth(
    pos: &Chess,
    options: &SearchOptions,
    start_time: Instant,
    max_time: Duration,
    ctx: &mut SearchContext,
) -> (SearchResult, bool) {
    let legals = pos.legal_moves();
    if legals.is_empty() {
        return (
            SearchResult {
                best_move: None,
                eval: 0,
                nodes: 0,
                depth: options.max_depth,
                noise_applied: 0,
                debug_stats: SearchDebugStats::default(),
                hce_debug_info: None,
                nnue_debug_info: None,
                random_error_debug_info: None,
            },
            false,
        );
    }

    let mut current_pos = pos.clone();
    let hce_evaluator = HceEvaluator::new();

    // 1. Mate-in-1 Fast Path
    for m in &legals {
        let mut child_pos = current_pos.clone();
        child_pos.play_unchecked(m);
        if child_pos.is_checkmate() {
            return (
                SearchResult {
                    best_move: Some(m.clone()),
                    eval: 20000,
                    nodes: legals.len() as u64,
                    depth: 1,
                    noise_applied: 0,
                    debug_stats: SearchDebugStats::default(),
                    hce_debug_info: None,
                    nnue_debug_info: None,
                    random_error_debug_info: None,
                },
                false,
            );
        }
    }

    let initial_extension_budget = 3;
    let mut moves_evals: Vec<(Move, i32, i32, i32)> = Vec::new(); // (Move, raw_eval, noisy_eval, adjusted_eval)
    let mut total_nodes = 0;
    let mut aborted = false;

    let mut moves_vec: Vec<_> = legals.clone().into_iter().collect();
    moves_vec.sort_by_key(|m| -score_move(&current_pos, m));

    for m in moves_vec {
        if start_time.elapsed() >= max_time {
            aborted = true;
            break;
        }

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
            ctx,
        );
        total_nodes += n;

        if score == 0 && n == 0 && start_time.elapsed() >= max_time {
            aborted = true;
            break;
        }

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
        let is_beginner_learner =
            bot_id.contains("beginner") || bot_id.contains("learner") || bot_id.contains("core");
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
            let child_fen =
                clean_fen(&Fen::from_position(child_pos.clone(), EnPassantMode::Legal).to_string());
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
            let prev_prev_move = if len >= 4 {
                &options.recent_moves[len - 4]
            } else {
                ""
            };
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
        moves_evals.push((m.clone(), eval, noisy_eval, adjusted_eval));
    }

    if aborted {
        return (
            SearchResult {
                best_move: None,
                eval: 0,
                nodes: total_nodes,
                depth: options.max_depth,
                noise_applied: options.error_noise_cp,
                debug_stats: SearchDebugStats::default(),
                hce_debug_info: None,
                nnue_debug_info: None,
                random_error_debug_info: None,
            },
            true,
        );
    }

    // Sort moves by adjusted evaluation descending
    moves_evals.sort_by_key(|(_, _, _, adjusted)| -*adjusted);

    let (best_move, raw_eval_val, noisy_eval_val) = if let Some((m, raw, noisy, _)) = moves_evals.first() {
        (Some(m.clone()), *raw, *noisy)
    } else {
        (legals.first().cloned(), 0, 0)
    };

    let mut hce_debug_info = None;
    let mut nnue_debug_info = None;
    let mut random_error_debug_info = None;

    if let Some(ref m) = best_move {
        let mut child_pos = current_pos.clone();
        child_pos.play_unchecked(m);

        let use_all_pst = options.bot_profile_id.starts_with("learner_") || options.bot_profile_id.contains("learner");

        // 1. Populate HceDetailedScore if HCE is used
        if options.engine_type == "hce" {
            hce_debug_info = Some(hce_evaluator.evaluate_detailed(
                child_pos.board(),
                child_pos.turn(),
                use_all_pst,
            ));
        }

        // 2. Populate NnueDebugInfo if NNUE is used
        if options.engine_type == "nnue" {
            let features = crate::engine::nnue::features::extract_features(child_pos.board());
            let model = &crate::engine::nnue::EVALUATOR.model;
            let model_loaded = model.weights.status == crate::engine::nnue::weights::WeightsStatus::Trained;
            let raw_eval = model.forward(&features).unwrap_or(0);
            
            // Negate for turn perspective
            let final_nnue_eval = if child_pos.turn() == shakmaty::Color::White { raw_eval } else { -raw_eval };

            nnue_debug_info = Some(NnueDebugInfo {
                model_loaded,
                weights_source: model.weights.source.as_str().to_string(),
                weights_hash: "0xDEADBEEF".to_string(),
                input_features_count: 768,
                forward_pass_used: model_loaded,
                activation_type: "ARCHITECTURE_DECISION_CURRENTLY_FLOAT32_RELU".to_string(),
                quantization_type: "ARCHITECTURE_DECISION_CURRENTLY_FLOAT32_RELU".to_string(),
                raw_nnue_eval: raw_eval,
                final_nnue_eval,
            });
        }

        // 3. Populate RandomErrorDebugInfo if noise is configured
        if options.error_noise_cp > 0 {
            let error_applied = noisy_eval_val - raw_eval_val;
            let scale = options.error_noise_cp as f32;
            let factor = if scale > 0.0 { error_applied as f32 / scale } else { 0.0 };

            random_error_debug_info = Some(RandomErrorDebugInfo {
                raw_eval: raw_eval_val,
                random_factor: factor,
                bot_impairment_scale: scale,
                random_error_cp_applied: error_applied,
                final_eval: noisy_eval_val,
                formula_used: "Final_Eval = Raw_Eval + (Random_Factor * Bot_Impairment_Scale)".to_string(),
                applied_once: true,
            });
        }
    }

    (
        SearchResult {
            best_move,
            eval: noisy_eval_val,
            nodes: total_nodes,
            depth: options.max_depth,
            noise_applied: options.error_noise_cp,
            debug_stats: SearchDebugStats::default(),
            hce_debug_info,
            nnue_debug_info,
            random_error_debug_info,
        },
        false,
    )
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
            debug_stats: SearchDebugStats::default(),
            hce_debug_info: None,
            nnue_debug_info: None,
            random_error_debug_info: None,
        };
    }

    let max_time = options.max_time;
    let mut best_move_so_far = legals.first().cloned();
    let mut best_eval_so_far = 0;
    let mut total_nodes = 0;
    let mut depth_completed = 0;
    let mut depth_sequence = Vec::new();
    let mut stopped_by_timeout = false;
    let mut best_result_at_depth = None;

    let mut ctx = SearchContext {
        nodes_visited: 0,
        alpha_beta_cutoffs: 0,
        beta_cutoffs: 0,
        quiescence_nodes: 0,
        quiescence_depth_max: 0,
    };

    let target_depth = options.max_depth.max(1);

    for d in 1..=target_depth {
        if start_time.elapsed() >= max_time {
            stopped_by_timeout = true;
            break;
        }

        let mut current_options = options.clone();
        current_options.max_depth = d;

        let (result, aborted) = search_at_depth(pos, &current_options, start_time, max_time, &mut ctx);
        total_nodes += result.nodes;

        if aborted {
            stopped_by_timeout = true;
            break;
        }

        if let Some(m) = result.best_move.clone() {
            best_move_so_far = Some(m);
            best_eval_so_far = result.eval;
            depth_completed = d;
            depth_sequence.push(d as u32);
            best_result_at_depth = Some(result.clone());

            // Early exit on checkmate or forced mate
            if result.eval >= 15000 || result.eval <= -15000 {
                break;
            }
        }
    }

    let actual_time_ms = start_time.elapsed().as_millis() as u64;
    let returned_best_so_far = stopped_by_timeout && depth_completed > 0;

    let debug_stats = SearchDebugStats {
        depth_target: target_depth as u32,
        depth_reached: depth_completed as u32,
        depth_sequence,
        nodes_visited: ctx.nodes_visited,
        alpha_beta_cutoffs: ctx.alpha_beta_cutoffs,
        beta_cutoffs: ctx.beta_cutoffs,
        quiescence_nodes: ctx.quiescence_nodes,
        quiescence_depth_max: ctx.quiescence_depth_max,
        move_ordering_used: true,
        stopped_by_timeout,
        returned_best_so_far,
        actual_time_ms,
    };

    let (hce_info, nnue_info, random_info) = if let Some(res) = best_result_at_depth {
        (res.hce_debug_info, res.nnue_debug_info, res.random_error_debug_info)
    } else {
        (None, None, None)
    };

    SearchResult {
        best_move: best_move_so_far,
        eval: best_eval_so_far,
        nodes: total_nodes,
        depth: depth_completed,
        noise_applied: options.error_noise_cp,
        debug_stats,
        hce_debug_info: hce_info,
        nnue_debug_info: nnue_info,
        random_error_debug_info: random_info,
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
    ctx: &mut SearchContext,
) -> (i32, Option<Move>, u64) {
    ctx.nodes_visited += 1;

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
            &mut ctx.quiescence_depth_max,
        );
        ctx.quiescence_nodes += qs_nodes;
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
            ctx,
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
            ctx.alpha_beta_cutoffs += 1;
            ctx.beta_cutoffs += 1;
            break; // Beta cut-off
        }
    }

    (best_eval, best_move, nodes)
}
