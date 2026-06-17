use crate::ranked::elo::calculate_elo_change;
use crate::ranked::ranked_guard::check_ranked_guards;
use crate::ranked::ranked_types::RankedResult;
use crate::rooms::room_state::{RoomState, RoomStatus};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use shakmaty::Position;

type HmacSha256 = Hmac<Sha256>;

pub fn finalize_ranked_match(
    room: &mut RoomState,
    submitting_uid: &str,
    result: &str, // "white_win" | "black_win" | "draw" | "abandoned"
    reason: &str, // "checkmate" | "resign" | "timeout" | "draw_agreement" | "disconnect_abandon"
) -> Result<(RankedResult, String, String, i64), String> {
    // 1. Run sanity guards
    check_ranked_guards(room, submitting_uid, result, reason)?;

    // 2. Safe draw agreement check
    if reason == "draw_agreement" {
        match &room.draw_offered_by {
            None => return Err("no_active_draw_offer".to_string()),
            Some(offerer) => {
                if offerer == submitting_uid {
                    return Err("draw_not_agreed_by_opponent".to_string());
                }
            }
        }
    }

    // Both players must exist (already checked in guards but let's safely unwrap)
    let white = room.white.as_ref().unwrap();
    let black = room.black.as_ref().unwrap();

    // Verify outcome using Shakmaty
    let setup: shakmaty::fen::Fen = room
        .fen
        .parse()
        .map_err(|e| format!("invalid_fen: {}", e))?;
    let pos: shakmaty::Chess = setup
        .into_position(shakmaty::CastlingMode::Standard)
        .map_err(|e| format!("invalid_position: {}", e))?;

    if reason == "checkmate" {
        if !pos.is_checkmate() {
            return Err("not_checkmate".to_string());
        }
        let expected_result = if pos.turn() == shakmaty::Color::White {
            "black_win"
        } else {
            "white_win"
        };
        if result != expected_result {
            return Err("invalid_checkmate_outcome".to_string());
        }
    } else if reason == "stalemate" || reason == "insufficient_material" {
        let is_stalemate = pos.is_stalemate();
        let is_insufficient = pos.is_insufficient_material();
        if reason == "stalemate" && !is_stalemate {
            return Err("not_stalemate".to_string());
        }
        if reason == "insufficient_material" && !is_insufficient {
            return Err("not_insufficient_material".to_string());
        }
        if result != "draw" {
            return Err("invalid_draw_outcome".to_string());
        }
    } else if reason == "resign" {
        let expected_result = if submitting_uid == white.uid {
            "black_win"
        } else {
            "white_win"
        };
        if result != expected_result {
            return Err("invalid_resignation_outcome".to_string());
        }
    }

    // Calculate ELO changes
    let (_new_white, _new_black, delta_white, delta_black) =
        calculate_elo_change(white.rating, black.rating, result);

    // Update room state
    room.result_submitted = true;
    room.result_verified = true;
    room.status = RoomStatus::Completed;
    let now = chrono::Utc::now().timestamp_millis();
    room.updated_at_ms = now;

    // Generate verification tokens
    let verification_id = uuid::Uuid::new_v4().to_string();
    let r_match_id = room.ranked_match_id.as_deref().unwrap_or("");

    // Use HMAC-SHA256 for result signature
    let secret = std::env::var("RANKED_RESULT_HMAC_SECRET")
        .unwrap_or_else(|_| "default_ranked_secret".to_string());

    let payload = format!(
        "{}:{}:{}:{}:{}:{}",
        r_match_id, white.uid, black.uid, result, room.move_count, now
    );

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "failed_to_init_hmac".to_string())?;
    mac.update(payload.as_bytes());
    let sig_result = mac.finalize();
    let verification_hash = hex::encode(sig_result.into_bytes());

    let ranked_res = RankedResult {
        white_uid: white.uid.clone(),
        black_uid: black.uid.clone(),
        result: result.to_string(),
        reason: reason.to_string(),
        move_count: room.move_count,
        duration_ms: now - room.created_at_ms,
        rating_delta_white: delta_white,
        rating_delta_black: delta_black,
    };

    Ok((ranked_res, verification_id, verification_hash, now))
}
