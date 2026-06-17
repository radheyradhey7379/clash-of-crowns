use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RoomError {
    #[error("Room not found: {0}")]
    RoomNotFound(String),

    #[error("Room is full: {0}")]
    RoomFull(String),

    #[error("Room is not active")]
    RoomNotActive,

    #[error("Player is not in the room: {0}")]
    PlayerNotInRoom(String),

    #[error("It is not your turn")]
    OutOfTurn,

    #[error("Move number mismatch: expected {expected}, got {got}")]
    MoveNumberMismatch { expected: u32, got: u32 },

    #[error("Duplicate move number: {0}")]
    DuplicateMoveNumber(u32),

    #[error("Room is in a terminal state")]
    TerminalRoomState,

    #[error("Invalid move format")]
    #[allow(dead_code)]
    InvalidMoveFormat,

    #[error("Authentication required")]
    AuthRequired,

    #[error("Authentication failed: {0}")]
    AuthFailed(String),

    #[error("Illegal move")]
    IllegalMove,

    #[error("Protocol version mismatch: expected {expected}, got {got}")]
    ProtocolVersionMismatch { expected: String, got: String },
}
