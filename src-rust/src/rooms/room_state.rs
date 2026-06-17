use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoomMode {
    Friend,
    RankedArena,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoomStatus {
    Waiting,
    Ready,
    Active,
    Completed,
    Cancelled,
    Abandoned,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerSlot {
    pub uid: String,
    pub display_name: String,
    pub rating: i32,
    pub color: String, // "w" or "b"
    pub connected: bool,
    pub last_seen_ms: i64,
    pub ready: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoomState {
    pub room_id: String,
    pub mode: RoomMode,
    pub status: RoomStatus,

    pub white: Option<PlayerSlot>,
    pub black: Option<PlayerSlot>,

    pub fen: String,
    pub current_turn: String, // "w" or "b"
    pub move_count: u32,

    pub created_at_ms: i64,
    pub updated_at_ms: i64,

    pub reconnect_deadline_ms: Option<i64>,

    pub ranked_match_id: Option<String>,
    pub result_submitted: bool,
    pub result_verified: bool,
    pub draw_offered_by: Option<String>,
}
