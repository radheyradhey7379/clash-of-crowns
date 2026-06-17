use crate::rooms::room_manager::RoomManager;
use axum::extract::ws::Message;
use dashmap::DashMap;
use tokio::sync::mpsc::UnboundedSender;

pub struct ActiveConnection {
    pub sender: UnboundedSender<Message>,
    pub connection_id: String,
}

pub struct AppState {
    pub room_manager: RoomManager,
    // Maps uid -> ActiveConnection
    pub connections: DashMap<String, ActiveConnection>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            room_manager: RoomManager::new(),
            connections: DashMap::new(),
        }
    }

    pub fn register_connection(&self, uid: &str, sender: UnboundedSender<Message>) -> String {
        let connection_id = uuid::Uuid::new_v4().to_string();

        // Correction 6: Close/replace old connection if same uid connects again
        if let Some((_, old_conn)) = self.connections.remove(uid) {
            // Signal connection closure to old websocket loop
            let _ = old_conn.sender.send(Message::Close(None));
        }

        self.connections.insert(
            uid.to_string(),
            ActiveConnection {
                sender,
                connection_id: connection_id.clone(),
            },
        );

        connection_id
    }

    pub fn remove_connection(&self, uid: &str, connection_id: &str) -> bool {
        let mut removed = false;
        self.connections.retain(|k, v| {
            if k == uid {
                if v.connection_id == connection_id {
                    removed = true;
                    false // Remove
                } else {
                    true // Keep newer connection
                }
            } else {
                true
            }
        });
        removed
    }

    pub fn send_to_user(&self, uid: &str, msg: Message) -> bool {
        if let Some(conn) = self.connections.get(uid) {
            conn.sender.send(msg).is_ok()
        } else {
            false
        }
    }
}
