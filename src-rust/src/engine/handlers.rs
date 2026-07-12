#[cfg(not(target_arch = "wasm32"))]
use axum::Json;
use serde::{Deserialize, Serialize};
use shakmaty::fen::Fen;
use shakmaty::EnPassantMode;
use shakmaty::{CastlingMode, Chess, Position, Role, Square};
use std::str::FromStr;
use std::time::Duration;

use crate::engine::negamax::{search, SearchOptions};

#[derive(Deserialize)]
pub struct EngineMoveRequest {
    pub fen: String,
    pub engine_type: String,
    pub depth: usize,
    pub error_noise_cp: i32,
    pub max_think_time_ms: u64,
    pub bot_profile_id: Option<String>,
    pub recent_moves: Option<Vec<String>>,
    pub recent_fens: Option<Vec<String>>,
    pub ai_move_history: Option<Vec<String>>,
    pub full_move_history: Option<Vec<String>>,
    pub bot_tier: Option<String>,
    pub player_color: Option<String>,
    pub current_ply: Option<usize>,
}

impl Default for EngineMoveRequest {
    fn default() -> Self {
        EngineMoveRequest {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string(),
            engine_type: "hce".to_string(),
            depth: 1,
            error_noise_cp: 0,
            max_think_time_ms: 1000,
            bot_profile_id: None,
            recent_moves: None,
            recent_fens: None,
            ai_move_history: None,
            full_move_history: None,
            bot_tier: None,
            player_color: None,
            current_ply: None,
        }
    }
}

#[derive(Serialize)]
pub struct EngineMoveResponse {
    pub move_str: String,
    pub depth: usize,
    pub eval_cp: i32,
    pub think_time_ms: u64,
    pub noise_applied: i32,
    pub engine_used: String,
    pub weights_status: String,
    pub weights_source: String,
    pub inference_mode: String,
    pub debug_stats: Option<crate::engine::negamax::SearchDebugStats>,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn move_handler(
    Json(req): Json<EngineMoveRequest>,
) -> Result<Json<EngineMoveResponse>, (axum::http::StatusCode, String)> {
    if req.engine_type != "hce" && req.engine_type != "nnue" {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid engine_type".to_string(),
        ));
    }

    let start = std::time::Instant::now();

    let setup = Fen::from_str(&req.fen).unwrap_or_else(|_| Fen::default());
    let pos: Chess = setup
        .into_position(CastlingMode::Standard)
        .unwrap_or_else(|_| Chess::default());

    let options = SearchOptions {
        max_depth: req.depth,
        max_time: Duration::from_millis(req.max_think_time_ms),
        error_noise_cp: req.error_noise_cp,
        engine_type: req.engine_type.clone(),
        bot_profile_id: req.bot_profile_id.clone().unwrap_or_default(),
        recent_moves: req.recent_moves.clone().unwrap_or_default(),
        recent_fens: req.recent_fens.clone().unwrap_or_default(),
        ai_move_history: req.ai_move_history.clone().unwrap_or_default(),
        full_move_history: req.full_move_history.clone().unwrap_or_default(),
        bot_tier: req.bot_tier.clone().unwrap_or_default(),
        player_color: req.player_color.clone().unwrap_or_default(),
        current_ply: req.current_ply.unwrap_or_default(),
    };

    let result = search(&pos, &options);

    let move_str = result
        .best_move
        .map(|m| m.to_uci(CastlingMode::Standard).to_string())
        .unwrap_or_default();

    let elapsed = start.elapsed().as_millis() as u64;

    let (weights_status, weights_source, inference_mode) = if req.engine_type == "hce" {
        (
            "not_applicable".to_string(),
            "not_applicable".to_string(),
            "not_applicable".to_string(),
        )
    } else {
        let is_tensor = crate::engine::nnue::EVALUATOR.model.weights.status
            == crate::engine::nnue::weights::WeightsStatus::Trained;
        (
            crate::engine::nnue::EVALUATOR
                .model
                .weights
                .status
                .as_str()
                .to_string(),
            crate::engine::nnue::EVALUATOR
                .model
                .weights
                .source
                .as_str()
                .to_string(),
            if is_tensor {
                "tensor".to_string()
            } else {
                "placeholder".to_string()
            },
        )
    };

    Ok(Json(EngineMoveResponse {
        move_str,
        depth: result.depth,
        eval_cp: result.eval,
        think_time_ms: elapsed,
        noise_applied: result.noise_applied,
        engine_used: req.engine_type.clone(),
        weights_status,
        weights_source,
        inference_mode,
        debug_stats: Some(result.debug_stats),
    }))
}

#[derive(Deserialize)]
pub struct EngineEvalRequest {
    pub fen: String,
    pub engine_type: String,
}

#[derive(Serialize)]
pub struct EngineEvalResponse {
    pub eval_cp: i32,
    pub inference_mode: String,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn eval_handler(
    Json(req): Json<EngineEvalRequest>,
) -> Result<Json<EngineEvalResponse>, (axum::http::StatusCode, String)> {
    let setup = Fen::from_str(&req.fen).unwrap_or_else(|_| Fen::default());
    let pos: Chess = setup
        .into_position(CastlingMode::Standard)
        .unwrap_or_else(|_| Chess::default());

    let (eval, inference_mode) = if req.engine_type == "hce" {
        (
            crate::engine::hce::HceEvaluator::new().evaluate(pos.board(), pos.turn(), true),
            "not_applicable",
        )
    } else {
        let eval = crate::engine::nnue::EVALUATOR.evaluate(pos.board(), pos.turn());
        let mode = if crate::engine::nnue::EVALUATOR.model.weights.status
            == crate::engine::nnue::weights::WeightsStatus::Trained
        {
            "tensor"
        } else {
            "placeholder"
        };
        (eval, mode)
    };

    Ok(Json(EngineEvalResponse {
        eval_cp: eval,
        inference_mode: inference_mode.to_string(),
    }))
}

#[derive(Deserialize)]
pub struct SimulateRequest {
    pub profile_a_id: String,
    pub profile_a_engine: String,
    pub profile_a_depth: usize,
    pub profile_a_noise: i32,
    pub profile_b_id: String,
    pub profile_b_engine: String,
    pub profile_b_depth: usize,
    pub profile_b_noise: i32,
    pub max_moves: usize,
}

#[derive(Serialize)]
pub struct SimulateResponse {
    pub result: String,
    pub reason: String,
    pub move_count: usize,
    pub final_fen: String,
    pub duration_ms: u64,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn simulate_handler(Json(req): Json<SimulateRequest>) -> Json<SimulateResponse> {
    let start_time = std::time::Instant::now();
    let mut pos = Chess::default();
    let mut move_count = 0;

    let mut result = "draw".to_string();
    let mut reason = "max_moves".to_string();

    let max_moves = if req.max_moves > 0 {
        req.max_moves
    } else {
        200
    };
    let time_per_move = Duration::from_millis(500); // 500ms max think per move in simulation

    let mut history_fens = Vec::new();
    let starting_fen = Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string();
    history_fens.push(starting_fen);

    while move_count < max_moves {
        if pos.is_checkmate() {
            result = if pos.turn() == shakmaty::Color::White {
                "black_win".to_string()
            } else {
                "white_win".to_string()
            };
            reason = "checkmate".to_string();
            break;
        } else if pos.is_stalemate() {
            result = "draw".to_string();
            reason = "stalemate".to_string();
            break;
        } else if pos.is_insufficient_material() {
            result = "draw".to_string();
            reason = "insufficient_material".to_string();
            break;
        } else if pos.halfmoves() >= 100 {
            result = "draw".to_string();
            reason = "fifty_moves".to_string();
            break;
        }

        let current_fen = Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string();
        if is_threefold_repetition(&current_fen, &history_fens) {
            result = "draw".to_string();
            reason = "repetition".to_string();
            break;
        }

        // Determine which profile is to move
        let (depth, noise, engine_type) = if pos.turn() == shakmaty::Color::White {
            (
                req.profile_a_depth,
                req.profile_a_noise,
                req.profile_a_engine.clone(),
            )
        } else {
            (
                req.profile_b_depth,
                req.profile_b_noise,
                req.profile_b_engine.clone(),
            )
        };

        let options = SearchOptions {
            max_depth: depth,
            max_time: time_per_move,
            error_noise_cp: noise,
            engine_type,
            bot_profile_id: String::new(),
            recent_moves: Vec::new(),
            recent_fens: Vec::new(),
            ai_move_history: Vec::new(),
            full_move_history: Vec::new(),
            bot_tier: String::new(),
            player_color: String::new(),
            current_ply: 0,
        };

        let search_res = search(&pos, &options);

        if let Some(m) = search_res.best_move {
            pos.play_unchecked(&m);
            let next_fen_str = Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string();
            history_fens.push(next_fen_str);
            move_count += 1;
        } else {
            // Engine completely failed
            result = "draw".to_string();
            reason = "fallback".to_string();
            break;
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;

    let fen_obj = Fen::from_position(pos, EnPassantMode::Legal);

    Json(SimulateResponse {
        result,
        reason,
        move_count,
        final_fen: fen_obj.to_string(),
        duration_ms,
    })
}

#[derive(Deserialize)]
pub struct ValidateMoveRequest {
    pub fen: String,
    pub from: String,
    pub to: String,
    pub promotion: Option<String>,
    pub recent_fens: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct ValidateMoveResponse {
    pub valid: bool,
    pub next_fen: String,
    pub is_checkmate: bool,
    pub is_stalemate: bool,
    pub is_draw: bool,
    pub is_fifty_moves: bool,
    pub is_repetition: bool,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn validate_handler(Json(req): Json<ValidateMoveRequest>) -> Json<ValidateMoveResponse> {
    let setup = match Fen::from_str(&req.fen) {
        Ok(s) => s,
        Err(_) => {
            return Json(ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            })
        }
    };

    let pos: Chess = match setup.into_position(CastlingMode::Standard) {
        Ok(p) => p,
        Err(_) => {
            return Json(ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            })
        }
    };

    let from_sq = match Square::from_ascii(req.from.as_bytes()) {
        Ok(s) => s,
        Err(_) => {
            return Json(ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            })
        }
    };

    let to_sq = match Square::from_ascii(req.to.as_bytes()) {
        Ok(s) => s,
        Err(_) => {
            return Json(ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            })
        }
    };

    let mut promotion_role = None;
    if let Some(ref promo) = req.promotion {
        promotion_role = match promo.to_lowercase().as_str() {
            "q" => Some(Role::Queen),
            "r" => Some(Role::Rook),
            "b" => Some(Role::Bishop),
            "n" => Some(Role::Knight),
            _ => None,
        };
    }

    let legal_moves = pos.legal_moves();
    let matched_move = legal_moves.iter().find(|m| {
        if m.from() != Some(from_sq) || m.to() != to_sq {
            return false;
        }
        if let shakmaty::Move::Normal {
            promotion: Some(promo),
            ..
        } = m
        {
            if let Some(r) = promotion_role {
                return *promo == r;
            }
            return false;
        }
        promotion_role.is_none()
    });

    match matched_move {
        Some(mv) => {
            let next_pos = pos.clone();
            match next_pos.play(mv) {
                Ok(p2) => {
                    let next_fen = Fen::from_position(p2.clone(), EnPassantMode::Legal).to_string();
                    let is_checkmate = p2.is_checkmate();
                    let is_stalemate = p2.is_stalemate();
                    let is_fifty = p2.halfmoves() >= 100;
                    let is_insufficient = p2.is_insufficient_material();

                    let is_repetition = if let Some(ref fens) = req.recent_fens {
                        is_threefold_repetition(&next_fen, fens)
                    } else {
                        false
                    };

                    let is_draw = is_stalemate || is_fifty || is_insufficient || is_repetition;
                    Json(ValidateMoveResponse {
                        valid: true,
                        next_fen,
                        is_checkmate,
                        is_stalemate,
                        is_draw,
                        is_fifty_moves: is_fifty,
                        is_repetition,
                    })
                }
                Err(_) => Json(ValidateMoveResponse {
                    valid: false,
                    next_fen: req.fen.clone(),
                    is_checkmate: false,
                    is_stalemate: false,
                    is_draw: false,
                    is_fifty_moves: false,
                    is_repetition: false,
                }),
            }
        }
        None => Json(ValidateMoveResponse {
            valid: false,
            next_fen: req.fen.clone(),
            is_checkmate: false,
            is_stalemate: false,
            is_draw: false,
            is_fifty_moves: false,
            is_repetition: false,
        }),
    }
}

pub fn is_threefold_repetition(next_fen: &str, recent_fens: &[String]) -> bool {
    fn normalize_fen(fen: &str) -> String {
        let parts: Vec<&str> = fen.split_whitespace().collect();
        if parts.len() >= 4 {
            parts[0..4].join(" ")
        } else {
            fen.to_string()
        }
    }

    let target = normalize_fen(next_fen);
    let mut count = 1;
    for fen in recent_fens {
        if normalize_fen(fen) == target {
            count += 1;
            if count >= 3 {
                return true;
            }
        }
    }
    false
}

#[derive(Serialize)]
pub struct EngineStatusResponse {
    pub weights_status: String,
    pub weights_source: String,
    pub inference_mode: String,
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn status_handler() -> Json<EngineStatusResponse> {
    let is_tensor = crate::engine::nnue::EVALUATOR.model.weights.status
        == crate::engine::nnue::weights::WeightsStatus::Trained;
    let weights_status = crate::engine::nnue::EVALUATOR
        .model
        .weights
        .status
        .as_str()
        .to_string();
    let weights_source = crate::engine::nnue::EVALUATOR
        .model
        .weights
        .source
        .as_str()
        .to_string();
    let inference_mode = if is_tensor {
        "tensor".to_string()
    } else {
        "placeholder".to_string()
    };

    Json(EngineStatusResponse {
        weights_status,
        weights_source,
        inference_mode,
    })
}
