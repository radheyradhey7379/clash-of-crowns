use axum::{routing::get, Json, Router};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod chess;
mod config;
mod presence;
mod ranked;
mod rooms;
mod state;
mod ws;

#[cfg(test)]
mod tests;

#[tokio::main]
async fn main() {
    // 1. Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 2. Load Configuration
    let config = config::Config::from_env();
    info!(
        "Starting clash-of-crowns-realtime server with config: {:?}",
        config
    );

    // 3. Create shared application state
    let state = Arc::new(state::AppState::new());

    // 4. Spawn background cleanup task for stale/abandoned rooms
    let state_cleanup = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            state_cleanup.room_manager.cleanup_stale_rooms();
        }
    });

    // 5. Configure Router
    use axum::http::{HeaderValue, Method};
    use tower_http::cors::Any;

    let cors = if config.dev_mode {
        CorsLayer::permissive()
    } else {
        let mut allowed = Vec::new();
        for origin in &config.allowed_origins {
            if let Ok(hv) = origin.parse::<HeaderValue>() {
                allowed.push(hv);
            }
        }
        CorsLayer::new()
            .allow_origin(allowed)
            .allow_methods([Method::GET, Method::POST])
            .allow_headers(Any)
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/version", get(version_handler))
        .route("/ws", get(ws::handler::ws_handler))
        .with_state(state)
        .layer(cors);

    // 6. Bind listener and run server
    let addr = format!("{}:{}", config.host, config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("Server listening on http://{}", addr);

    axum::serve(listener, app).await.unwrap();
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "clash-realtime"
    }))
}

async fn version_handler() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "clash-realtime",
        "version": "0.1.0",
        "protocolVersion": "1.0.0"
    }))
}
