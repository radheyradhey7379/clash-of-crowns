use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Auth {
        uid: String,
        display_name: String,
        token: Option<String>,
        protocol_version: Option<String>,
        rating: Option<i32>,
    },

    CreateRoom {
        room_id: Option<String>,
        mode: String,
    },

    JoinRoom {
        room_id: String,
    },

    PlayerReady {
        room_id: String,
    },

    SubmitMove {
        room_id: String,
        move_number: u32,
        from: String,
        to: String,
        promotion: Option<String>,
        fen_after: String,
        san: Option<String>,
        client_message_id: Option<String>,
    },

    OfferDraw {
        room_id: String,
    },

    RespondDraw {
        room_id: String,
        accepted: bool,
    },

    Resign {
        room_id: String,
    },

    SubmitResult {
        room_id: String,
        result: String,
        reason: String,
    },

    Heartbeat {
        room_id: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    AuthOk {
        uid: String,
    },

    Error {
        code: String,
        message: String,
        client_message_id: Option<String>,
    },

    RoomCreated {
        room_id: String,
    },

    RoomJoined {
        room_id: String,
        color: String,
    },

    RoomState {
        room_id: String,
        mode: String,
        status: String,
        fen: String,
        current_turn: String,
        move_count: u32,
        white_uid: Option<String>,
        black_uid: Option<String>,
        ranked_match_id: Option<String>,
        result_submitted: bool,
        result_verified: bool,
    },

    MoveAccepted {
        room_id: String,
        move_number: u32,
        fen_after: String,
        current_turn: String,
        client_message_id: Option<String>,
    },

    OpponentMove {
        room_id: String,
        move_number: u32,
        from: String,
        to: String,
        promotion: Option<String>,
        fen_after: String,
        san: Option<String>,
    },

    OpponentDisconnected {
        room_id: String,
        reconnect_seconds: u64,
    },

    OpponentReconnected {
        room_id: String,
    },

    MatchEnded {
        room_id: String,
        result: String,
        reason: String,
        winner_uid: Option<String>,
    },

    VerifiedResult {
        room_id: String,
        ranked_match_id: String,
        white_uid: String,
        black_uid: String,
        result: String,
        reason: String,
        move_count: u32,
        timestamp: i64,
        duration_ms: i64,
        rating_delta_white: i32,
        rating_delta_black: i32,
        new_rating_white: i32,
        new_rating_black: i32,
        verification_hash: String,
    },

    ResultError {
        room_id: String,
        code: String,
        message: String,
    },

    Pong {
        server_time: i64,
    },
}
