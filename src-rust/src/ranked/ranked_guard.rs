use crate::rooms::room_state::{RoomMode, RoomState, RoomStatus};

pub fn check_ranked_guards(
    room: &RoomState,
    submitting_uid: &str,
    result: &str,
    reason: &str,
) -> Result<(), String> {
    // 1. Must be ranked_arena room
    if room.mode != RoomMode::RankedArena {
        return Err("invalid_room_mode".to_string());
    }

    // 2. Both players must exist
    if room.white.is_none() || room.black.is_none() {
        return Err("missing_players".to_string());
    }

    // 3. Submitting player must be a participant
    let white_uid = room.white.as_ref().map(|w| &w.uid);
    let black_uid = room.black.as_ref().map(|b| &b.uid);
    if Some(submitting_uid) != white_uid.map(|s| s.as_str())
        && Some(submitting_uid) != black_uid.map(|s| s.as_str())
    {
        return Err("not_a_participant".to_string());
    }

    // 4. Must be active (or completed if we block duplicates)
    if room.status != RoomStatus::Active {
        return Err("room_not_active".to_string());
    }

    // 5. No duplicate submission
    if room.result_submitted {
        return Err("result_already_submitted".to_string());
    }

    // 6. Low move count sanity checks
    // Draw or checkmate requires at least 2 moves. If low move count, we flag it.
    if (result == "draw" || reason == "checkmate") && room.move_count < 2 {
        return Err("suspicious_match_too_short".to_string());
    }

    Ok(())
}
