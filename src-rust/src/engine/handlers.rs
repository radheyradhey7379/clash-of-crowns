use axum::Json;
use serde::{Deserialize, Serialize};
use shakmaty::fen::Fen;
use shakmaty::EnPassantMode;
use shakmaty::{CastlingMode, Chess, Position};
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
}

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

pub async fn eval_handler(
    Json(req): Json<EngineEvalRequest>,
) -> Result<Json<EngineEvalResponse>, (axum::http::StatusCode, String)> {
    let setup = Fen::from_str(&req.fen).unwrap_or_else(|_| Fen::default());
    let pos: Chess = setup
        .into_position(CastlingMode::Standard)
        .unwrap_or_else(|_| Chess::default());

    let (eval, inference_mode) = if req.engine_type == "hce" {
        (
            crate::engine::hce::HceEvaluator::new().evaluate(pos.board(), pos.turn()),
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
            reason = "repetition".to_string(); // we'll lump this here since shakmaty handles it
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
        };

        let search_res = search(&pos, &options);

        if let Some(m) = search_res.best_move {
            pos.play_unchecked(&m);
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
