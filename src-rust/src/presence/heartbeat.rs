use crate::rooms::room_manager::RoomManager;
use crate::rooms::room_state::RoomState;

pub fn handle_client_heartbeat(
    room_manager: &RoomManager,
    room_id: Option<&str>,
    uid: &str,
) -> Option<RoomState> {
    if let Some(r_id) = room_id {
        if let Some(room) = room_manager.get_room(r_id) {
            let mut matched = false;
            if let Some(ref w) = room.white {
                if w.uid == uid {
                    matched = true;
                }
            }
            if let Some(ref b) = room.black {
                if b.uid == uid {
                    matched = true;
                }
            }
            if matched {
                return room_manager.mark_reconnected(r_id, uid);
            }
        }
    }
    None
}
