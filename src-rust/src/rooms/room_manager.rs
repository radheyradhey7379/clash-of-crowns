use crate::rooms::room_errors::RoomError;
use crate::rooms::room_state::{PlayerSlot, RoomMode, RoomState, RoomStatus};
use dashmap::DashMap;

pub struct RoomManager {
    rooms: DashMap<String, RoomState>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: DashMap::new(),
        }
    }

    pub fn create_room(
        &self,
        room_id: Option<String>,
        mode: RoomMode,
        host_uid: String,
        host_name: String,
        host_rating: i32,
    ) -> RoomState {
        let id = room_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()[0..8].to_string());
        let now = chrono::Utc::now().timestamp_millis();

        let ranked_match_id = if mode == RoomMode::RankedArena {
            Some(uuid::Uuid::new_v4().to_string())
        } else {
            None
        };

        let room = RoomState {
            room_id: id.clone(),
            mode,
            status: RoomStatus::Waiting,
            white: Some(PlayerSlot {
                uid: host_uid,
                display_name: host_name,
                rating: host_rating,
                color: "w".to_string(),
                connected: true,
                last_seen_ms: now,
                ready: false,
            }),
            black: None,
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string(),
            current_turn: "w".to_string(),
            move_count: 0,
            created_at_ms: now,
            updated_at_ms: now,
            reconnect_deadline_ms: None,
            ranked_match_id,
            result_submitted: false,
            result_verified: false,
            draw_offered_by: None,
        };

        self.rooms.insert(id.clone(), room.clone());
        room
    }

    pub fn join_room(
        &self,
        room_id: &str,
        guest_uid: &str,
        guest_name: &str,
        guest_rating: i32,
    ) -> Result<RoomState, RoomError> {
        let mut room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| RoomError::RoomNotFound(room_id.to_string()))?;

        // If guest is already white
        if let Some(ref w) = room.white {
            if w.uid == guest_uid {
                return Ok(room.clone());
            }
        }

        // If guest is already black
        if let Some(ref b) = room.black {
            if b.uid == guest_uid {
                return Ok(room.clone());
            } else {
                return Err(RoomError::RoomFull(room_id.to_string()));
            }
        }

        // Check terminal state
        match room.status {
            RoomStatus::Completed | RoomStatus::Cancelled | RoomStatus::Abandoned => {
                return Err(RoomError::TerminalRoomState);
            }
            _ => {}
        }

        let now = chrono::Utc::now().timestamp_millis();
        room.black = Some(PlayerSlot {
            uid: guest_uid.to_string(),
            display_name: guest_name.to_string(),
            rating: guest_rating,
            color: "b".to_string(),
            connected: true,
            last_seen_ms: now,
            ready: false,
        });

        if room.status == RoomStatus::Waiting {
            room.status = RoomStatus::Ready;
        }
        room.updated_at_ms = now;

        Ok(room.clone())
    }

    pub fn player_ready(&self, room_id: &str, uid: &str) -> Result<RoomState, RoomError> {
        let mut room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| RoomError::RoomNotFound(room_id.to_string()))?;

        let mut is_white = false;
        let mut is_black = false;

        if let Some(ref mut w) = room.white {
            if w.uid == uid {
                w.ready = true;
                is_white = true;
            }
        }
        if let Some(ref mut b) = room.black {
            if b.uid == uid {
                b.ready = true;
                is_black = true;
            }
        }

        if !is_white && !is_black {
            return Err(RoomError::PlayerNotInRoom(uid.to_string()));
        }

        let both_ready = room.white.as_ref().map(|w| w.ready).unwrap_or(false)
            && room.black.as_ref().map(|b| b.ready).unwrap_or(false);

        if both_ready && room.status == RoomStatus::Ready {
            room.status = RoomStatus::Active;
        }

        let now = chrono::Utc::now().timestamp_millis();
        room.updated_at_ms = now;

        Ok(room.clone())
    }

    pub fn submit_move(
        &self,
        room_id: &str,
        uid: &str,
        move_number: u32,
        from: &str,
        to: &str,
        promotion: Option<String>,
        _fen_after: &str,
    ) -> Result<RoomState, RoomError> {
        let mut room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| RoomError::RoomNotFound(room_id.to_string()))?;

        // 1. Reject terminal states
        match room.status {
            RoomStatus::Completed | RoomStatus::Cancelled | RoomStatus::Abandoned => {
                return Err(RoomError::TerminalRoomState);
            }
            _ => {}
        }

        // 2. Room must be active
        if room.status != RoomStatus::Active {
            return Err(RoomError::RoomNotActive);
        }

        // 3. Move sequence and turn validations
        crate::chess::move_validator::validate_move_sequence(&room, uid, move_number)?;

        // 4. Validate and execute move using Shakmaty
        let (next_fen, is_checkmate, is_stalemate, is_draw) =
            crate::chess::move_validator::validate_and_execute_move(
                &room.fen,
                from,
                to,
                promotion.as_deref(),
            )?;

        // 5. Update state
        room.fen = next_fen;
        room.current_turn = if room.current_turn == "w" {
            "b".to_string()
        } else {
            "w".to_string()
        };
        room.move_count = move_number;

        if is_checkmate || is_stalemate || is_draw {
            room.status = RoomStatus::Completed;
        }

        let now = chrono::Utc::now().timestamp_millis();
        room.updated_at_ms = now;

        Ok(room.clone())
    }

    pub fn mark_disconnected(&self, room_id: &str, uid: &str) -> Option<RoomState> {
        let mut room = self.rooms.get_mut(room_id)?;
        let now = chrono::Utc::now().timestamp_millis();

        let mut found = false;
        if let Some(ref mut w) = room.white {
            if w.uid == uid {
                w.connected = false;
                w.last_seen_ms = now;
                found = true;
            }
        }
        if let Some(ref mut b) = room.black {
            if b.uid == uid {
                b.connected = false;
                b.last_seen_ms = now;
                found = true;
            }
        }

        if found {
            room.reconnect_deadline_ms = Some(now + 60_000);
            room.updated_at_ms = now;
            Some(room.clone())
        } else {
            None
        }
    }

    pub fn mark_reconnected(&self, room_id: &str, uid: &str) -> Option<RoomState> {
        let mut room = self.rooms.get_mut(room_id)?;
        let now = chrono::Utc::now().timestamp_millis();

        let mut found = false;
        if let Some(ref mut w) = room.white {
            if w.uid == uid {
                w.connected = true;
                w.last_seen_ms = now;
                found = true;
            }
        }
        if let Some(ref mut b) = room.black {
            if b.uid == uid {
                b.connected = true;
                b.last_seen_ms = now;
                found = true;
            }
        }

        if found {
            let both_connected = room.white.as_ref().map(|w| w.connected).unwrap_or(false)
                && room.black.as_ref().map(|b| b.connected).unwrap_or(false);

            if both_connected {
                room.reconnect_deadline_ms = None;
            }
            room.updated_at_ms = now;
            Some(room.clone())
        } else {
            None
        }
    }

    pub fn end_match(&self, room_id: &str, status: RoomStatus) -> Result<RoomState, RoomError> {
        let mut room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| RoomError::RoomNotFound(room_id.to_string()))?;
        room.status = status;
        let now = chrono::Utc::now().timestamp_millis();
        room.updated_at_ms = now;
        Ok(room.clone())
    }

    pub fn get_room(&self, room_id: &str) -> Option<RoomState> {
        self.rooms.get(room_id).map(|r| r.clone())
    }

    pub fn get_room_mut(
        &self,
        room_id: &str,
    ) -> Option<dashmap::mapref::one::RefMut<'_, String, RoomState>> {
        self.rooms.get_mut(room_id)
    }

    pub fn offer_draw(&self, room_id: &str, uid: &str) -> Result<RoomState, RoomError> {
        let mut room = self
            .rooms
            .get_mut(room_id)
            .ok_or_else(|| RoomError::RoomNotFound(room_id.to_string()))?;
        room.draw_offered_by = Some(uid.to_string());
        let now = chrono::Utc::now().timestamp_millis();
        room.updated_at_ms = now;
        Ok(room.clone())
    }

    pub fn find_waiting_ranked_room(&self, exclude_uid: &str) -> Option<String> {
        for entry in self.rooms.iter() {
            let room = entry.value();
            if room.mode == RoomMode::RankedArena && room.status == RoomStatus::Waiting {
                if let Some(ref w) = room.white {
                    if w.uid != exclude_uid {
                        return Some(room.room_id.clone());
                    }
                }
            }
        }
        None
    }

    pub fn cleanup_stale_rooms(&self) {
        let now = chrono::Utc::now().timestamp_millis();
        for mut r in self.rooms.iter_mut() {
            if let Some(deadline) = r.reconnect_deadline_ms {
                if now > deadline && r.status == RoomStatus::Active {
                    r.status = RoomStatus::Abandoned;
                    r.reconnect_deadline_ms = None;
                    r.updated_at_ms = now;
                }
            }
        }
    }
}
