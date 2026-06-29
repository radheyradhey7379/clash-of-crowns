use axum::{routing::get, Json, Router};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod chess;
mod config;
mod engine;
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
    use axum::http::HeaderValue;

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
            .allow_methods(tower_http::cors::Any)
            .allow_headers(tower_http::cors::Any)
    };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/version", get(version_handler))
        .route("/ws", get(ws::handler::ws_handler))
        .route("/engine/move", axum::routing::post(engine::move_handler))
        .route("/engine/eval", axum::routing::post(engine::eval_handler))
        .route(
            "/engine/validate",
            axum::routing::post(engine::validate_handler),
        )
        .route(
            "/engine/simulate",
            axum::routing::post(engine::simulate_handler),
        )
        .route("/engine/status", axum::routing::get(engine::status_handler))
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
    let path = std::env::var("NNUE_WEIGHTS_PATH").unwrap_or_default();
    let file_exists = if !path.is_empty() {
        std::path::Path::new(&path).exists()
    } else {
        false
    };
    let weights_status = crate::engine::nnue::EVALUATOR
        .model
        .weights
        .status
        .as_str()
        .to_string();

    let mut secrets_files = Vec::new();
    let mut read_errors = serde_json::Map::new();

    if let Ok(entries) = std::fs::read_dir("/etc/secrets") {
        for entry in entries.flatten() {
            if let Ok(name) = entry.file_name().into_string() {
                secrets_files.push(name.clone());
                let subpath = format!("/etc/secrets/{}", name);
                match std::fs::read_dir(&subpath) {
                    Ok(sub_entries) => {
                        for sub_entry in sub_entries.flatten() {
                            if let Ok(sub_name) = sub_entry.file_name().into_string() {
                                secrets_files.push(format!("{}/{}", name, sub_name));
                            }
                        }
                    }
                    Err(e) => {
                        read_errors.insert(subpath, serde_json::Value::String(e.to_string()));
                    }
                }
            }
        }
    }

    Json(serde_json::json!({
        "service": "clash-realtime",
        "version": "0.1.0",
        "protocolVersion": "1.0.0",
        "nnue_weights_path": path,
        "nnue_weights_file_exists": file_exists,
        "nnue_weights_status": weights_status,
        "secrets_files": secrets_files,
        "secrets_read_errors": read_errors
    }))
}
