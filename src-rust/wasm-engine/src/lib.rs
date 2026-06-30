use wasm_bindgen::prelude::*;
use serde_json;
use shakmaty::fen::Fen;
use shakmaty::EnPassantMode;
use shakmaty::{CastlingMode, Chess, Position, Role, Square};
use std::str::FromStr;
use std::time::Duration;

#[path = "../../src/engine/mod.rs"]
pub mod engine;

use crate::engine::negamax::{search, SearchOptions};

#[wasm_bindgen]
pub fn compute_move(request_json: &str) -> String {
    let req: engine::handlers::EngineMoveRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(e) => return format!("{{\"error\":\"Invalid JSON request: {}\"}}", e),
    };

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
    };

    let start = instant::Instant::now();
    let result = search(&pos, &options);
    let elapsed = start.elapsed().as_millis() as u64;

    let move_str = result
        .best_move
        .map(|m| m.to_uci(CastlingMode::Standard).to_string())
        .unwrap_or_default();

    let (weights_status, weights_source, inference_mode) = if req.engine_type == "hce" {
        (
            "not_applicable".to_string(),
            "not_applicable".to_string(),
            "not_applicable".to_string(),
        )
    } else {
        let is_tensor = engine::nnue::EVALUATOR.model.weights.status
            == engine::nnue::weights::WeightsStatus::Trained;
        (
            engine::nnue::EVALUATOR
                .model
                .weights
                .status
                .as_str()
                .to_string(),
            engine::nnue::EVALUATOR
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

    let response = engine::handlers::EngineMoveResponse {
        move_str,
        depth: result.depth,
        eval_cp: result.eval,
        think_time_ms: elapsed,
        noise_applied: result.noise_applied,
        engine_used: req.engine_type,
        weights_status,
        weights_source,
        inference_mode,
    };

    serde_json::to_string(&response).unwrap_or_default()
}

#[wasm_bindgen]
pub fn validate_move(request_json: &str) -> String {
    let req: engine::handlers::ValidateMoveRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(e) => return format!("{{\"error\":\"Invalid JSON request: {}\"}}", e),
    };

    let setup = match Fen::from_str(&req.fen) {
        Ok(s) => s,
        Err(_) => {
            return serde_json::to_string(&engine::handlers::ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            }).unwrap_or_default()
        }
    };

    let pos: Chess = match setup.into_position(CastlingMode::Standard) {
        Ok(p) => p,
        Err(_) => {
            return serde_json::to_string(&engine::handlers::ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            }).unwrap_or_default()
        }
    };

    let from_sq = match Square::from_ascii(req.from.as_bytes()) {
        Ok(s) => s,
        Err(_) => {
            return serde_json::to_string(&engine::handlers::ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            }).unwrap_or_default()
        }
    };

    let to_sq = match Square::from_ascii(req.to.as_bytes()) {
        Ok(s) => s,
        Err(_) => {
            return serde_json::to_string(&engine::handlers::ValidateMoveResponse {
                valid: false,
                next_fen: req.fen.clone(),
                is_checkmate: false,
                is_stalemate: false,
                is_draw: false,
                is_fifty_moves: false,
                is_repetition: false,
            }).unwrap_or_default()
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

    let response = match matched_move {
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
                        engine::handlers::is_threefold_repetition(&next_fen, fens)
                    } else {
                        false
                    };

                    let is_draw = is_stalemate || is_fifty || is_insufficient || is_repetition;
                    engine::handlers::ValidateMoveResponse {
                        valid: true,
                        next_fen,
                        is_checkmate,
                        is_stalemate,
                        is_draw,
                        is_fifty_moves: is_fifty,
                        is_repetition,
                    }
                }
                Err(_) => engine::handlers::ValidateMoveResponse {
                    valid: false,
                    next_fen: req.fen.clone(),
                    is_checkmate: false,
                    is_stalemate: false,
                    is_draw: false,
                    is_fifty_moves: false,
                    is_repetition: false,
                },
            }
        }
        None => engine::handlers::ValidateMoveResponse {
            valid: false,
            next_fen: req.fen.clone(),
            is_checkmate: false,
            is_stalemate: false,
            is_draw: false,
            is_fifty_moves: false,
            is_repetition: false,
        },
    };

    serde_json::to_string(&response).unwrap_or_default()
}

#[wasm_bindgen]
pub fn simulate_round_robin(request_json: &str) -> String {
    let req: engine::handlers::SimulateRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(e) => return format!("{{\"error\":\"Invalid JSON request: {}\"}}", e),
    };

    let start_time = instant::Instant::now();
    let mut pos = Chess::default();
    let mut move_count = 0;

    let mut result = "draw".to_string();
    let mut reason = "max_moves".to_string();

    let max_moves = if req.max_moves > 0 {
        req.max_moves
    } else {
        200
    };
    let time_per_move = Duration::from_millis(500);

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
        if engine::handlers::is_threefold_repetition(&current_fen, &history_fens) {
            result = "draw".to_string();
            reason = "repetition".to_string();
            break;
        }

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
        };

        let search_res = search(&pos, &options);

        if let Some(m) = search_res.best_move {
            pos.play_unchecked(&m);
            let next_fen_str = Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string();
            history_fens.push(next_fen_str);
            move_count += 1;
        } else {
            result = "draw".to_string();
            reason = "fallback".to_string();
            break;
        }
    }

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let fen_obj = Fen::from_position(pos, EnPassantMode::Legal);

    let response = engine::handlers::SimulateResponse {
        result,
        reason,
        move_count,
        final_fen: fen_obj.to_string(),
        duration_ms,
    };

    serde_json::to_string(&response).unwrap_or_default()
}

#[wasm_bindgen]
pub fn get_engine_info() -> String {
    let is_tensor = engine::nnue::EVALUATOR.model.weights.status
        == engine::nnue::weights::WeightsStatus::Trained;
    let weights_status = engine::nnue::EVALUATOR
        .model
        .weights
        .status
        .as_str()
        .to_string();
    let weights_source = engine::nnue::EVALUATOR
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

    let response = engine::handlers::EngineStatusResponse {
        weights_status,
        weights_source,
        inference_mode,
    };

    serde_json::to_string(&response).unwrap_or_default()
}
