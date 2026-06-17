# Render Live Deployments & Environment Settings

This document outlines the configured environment variables and live endpoint URLs for the Clash of Crowns production deployment on Render.

## 1. Live Render Endpoints
The application connects to the following production URLs:
- **Node Backend URL**: `https://clash-of-crowns-node.onrender.com`
  - Serves REST APIs (e.g. `/api/narration`, `/api/health`, `/api/version`, `/api/auth/session-token`).
- **Rust Realtime HTTP URL**: `https://clash-of-crowns-rust.onrender.com`
  - Serves HTTP health check (`/health`) and version (`/version`) endpoints.
- **Rust Realtime WS URL**: `wss://clash-of-crowns-rust.onrender.com/ws`
  - Serves Axum WebSocket connections for real-time multiplayer lobbies and games.

## 2. Environment Variables (.env)
The environment configuration uses the following keys (defined in `.env` locally and in the Render dashboard for production):

```env
# Application Version
VITE_APP_VERSION=1.0.0

# Multiplayer & Live Services Enabled Flags
VITE_ENABLE_MULTIPLAYER=true
VITE_ENABLE_RUST_REALTIME=true
VITE_ENABLE_RANKED_ARENA=false
VITE_ENABLE_TOURNAMENTS=false

# Render Live Endpoints
VITE_API_BASE_URL=https://clash-of-crowns-node.onrender.com
VITE_REALTIME_HTTP_URL=https://clash-of-crowns-rust.onrender.com
VITE_REALTIME_WS_URL=wss://clash-of-crowns-rust.onrender.com/ws

# Firebase Web Config
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 3. Allowed Origins configuration
On the Node and Rust backends, CORS and socket access origins must include the frontend production testing origin and the native mobile WebView client:
- Node: `ALLOWED_ORIGINS` includes the correct frontend test domain and `capacitor://localhost` (for Android).
- Rust: CORS setup allows `capacitor://localhost` and the Render frontend origin to allow WebSocket handshake.
