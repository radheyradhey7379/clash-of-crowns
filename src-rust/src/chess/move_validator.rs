use crate::rooms::room_errors::RoomError;
use crate::rooms::room_state::RoomState;
use shakmaty::fen::Fen;
use shakmaty::{Chess, Position, Role, Square};

pub fn validate_move_sequence(
    room: &RoomState,
    uid: &str,
    move_number: u32,
) -> Result<(), RoomError> {
    // Player must be in room and identify color
    let is_white = room.white.as_ref().map(|w| w.uid == uid).unwrap_or(false);
    let is_black = room.black.as_ref().map(|b| b.uid == uid).unwrap_or(false);

    if !is_white && !is_black {
        return Err(RoomError::PlayerNotInRoom(uid.to_string()));
    }

    if move_number <= room.move_count {
        return Err(RoomError::DuplicateMoveNumber(move_number));
    }

    if move_number != room.move_count + 1 {
        return Err(RoomError::MoveNumberMismatch {
            expected: room.move_count + 1,
            got: move_number,
        });
    }

    let player_color = if is_white { "w" } else { "b" };
    if room.current_turn != player_color {
        return Err(RoomError::OutOfTurn);
    }

    Ok(())
}

pub fn validate_and_execute_move(
    fen: &str,
    from: &str,
    to: &str,
    promotion: Option<&str>,
) -> Result<(String, bool, bool, bool), RoomError> {
    let setup: Fen = fen.parse().map_err(|_| RoomError::InvalidMoveFormat)?;
    let pos: Chess = setup
        .into_position(shakmaty::CastlingMode::Standard)
        .map_err(|_| RoomError::InvalidMoveFormat)?;

    let from_sq = Square::from_ascii(from.as_bytes()).map_err(|_| RoomError::InvalidMoveFormat)?;
    let to_sq = Square::from_ascii(to.as_bytes()).map_err(|_| RoomError::InvalidMoveFormat)?;

    let mut promotion_role = None;
    if let Some(promo) = promotion {
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

    let mv = matched_move.ok_or(RoomError::IllegalMove)?;
    let pos = pos.play(mv).map_err(|_| RoomError::IllegalMove)?;

    let next_fen = Fen::from_position(pos.clone(), shakmaty::EnPassantMode::Legal).to_string();
    let is_checkmate = pos.is_checkmate();
    let is_stalemate = pos.is_stalemate();
    let is_insufficient = pos.is_insufficient_material();
    let is_draw = is_stalemate || is_insufficient;

    Ok((next_fen, is_checkmate, is_stalemate, is_draw))
}
