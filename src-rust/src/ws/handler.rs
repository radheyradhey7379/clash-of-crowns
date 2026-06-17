use crate::state::AppState;
use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::IntoResponse,
};
use std::sync::Arc;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| crate::ws::connection::handle_connection(socket, state))
}
