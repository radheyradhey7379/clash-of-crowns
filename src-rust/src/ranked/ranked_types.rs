use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedMatchState {
    pub ranked_match_id: String,
    pub room_id: String,
    pub white_uid: String,
    pub black_uid: String,
    pub white_start_rating: i32,
    pub black_start_rating: i32,
    pub white_new_rating: Option<i32>,
    pub black_new_rating: Option<i32>,
    pub result: Option<String>,
    pub reason: Option<String>,
    pub started_at_ms: i64,
    pub ended_at_ms: Option<i64>,
    pub move_count: u32,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedResult {
    pub white_uid: String,
    pub black_uid: String,
    pub result: String, // "white_win" | "black_win" | "draw" | "abandoned"
    pub reason: String, // "checkmate" | "resign" | "timeout" | "draw_agreement" | "disconnect_abandon"
    pub move_count: u32,
    pub duration_ms: i64,
    pub rating_delta_white: i32,
    pub rating_delta_black: i32,
}
