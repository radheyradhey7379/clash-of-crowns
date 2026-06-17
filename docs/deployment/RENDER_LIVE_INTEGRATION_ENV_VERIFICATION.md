# Render Live Integration & Environment Verification

This document verifies the live production URLs, endpoints, and CORS origin policies for Clash of Crowns.

## 1. Production Backend Service Endpoints

The application interacts with the following live Render servers:

- **Node.js API Server:** `https://clash-of-crowns-node.onrender.com`
  - Health check endpoint: `/api/health`
  - Session token generation: `/api/auth/session-token`
  - Narration audio: `/api/narration`
  - Checkout session: `/api/create-checkout-session`
  - ELO verification: `/api/ranked/verify-and-apply`
  
- **Rust Realtime WS Server (HTTP):** `https://clash-of-crowns-rust.onrender.com`
  - Health check endpoint: `/health`
  
- **Rust Realtime WS Server (WebSocket):** `wss://clash-of-crowns-rust.onrender.com/ws`
  - Heartbeat/Pong RTT latency tracking.

## 2. API Path Resolution (getApiUrl)

To support native Capacitor environments (Android/iOS) where paths are absolute, and standard web browsers where paths are relative:
- All relative `/api` fetches must be wrapped in `getApiUrl(path)`.
- `getApiUrl` automatically prepends the absolute URL `VITE_API_BASE_URL` if defined in environment variables.

## 3. Allowed Origins & CORS Gating

To permit connections from web browsers and mobile Capactor applications:
- The Node.js Express server is configured with `app.use(cors())` permitting requests from any origin (`*`).
- The Socket.io configuration is open to any origin (`*`) for cross-compatible WebSocket signaling.
- For maximum security in final production, we recommend restricting CORS allowed origins to the authorized client domains (`https://clash-of-crowns-node.onrender.com`, frontend domains) and `capacitor://localhost`.
