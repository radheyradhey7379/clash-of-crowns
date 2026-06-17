# Rust Realtime WSS Deployment Report

This report documents the security configurations, socket handlers, and deployment procedures for the Rust realtime Axum WebSocket backend.

## 1. WebSocket Server Specifications
The Rust backend coordinates realtime moves, turn orders, room states, and matchmaking:
- **WebSocket Gateway**: Axum-based websocket server utilizing `tokio` for async connection pooling.
- **Connection Security**: Requires a valid, short-lived HMAC session token (issued by Node backend) to connect. Unauthenticated requests are immediately disconnected.
- **Chess Authority**: Enforces chess laws on the server-side via the `shakmaty` crate.
- **Cheating Mitigation**: Validates that moves correspond to the current player's color, follow turn sequences, and are physically legal within the board's current FEN representation.

## 2. Deploy Configuration
- **DEV_MODE**: `false` (Forces token verification using `SESSION_TOKEN_SECRET`).
- **Heartbeat Timeout**: Disconnects inactive client nodes after 30 seconds of quiet.
- **Cleanups**: Automatically deallocates memory and terminates rooms upon user disconnects.

## 3. Deployment Topology
- **Proxy Setup**: Deployed behind a TLS reverse proxy (e.g., NGINX, Caddy, or Cloudflare Tunnel) terminating TLS and forwarding WSS traffic to Axum on internal port `3001`.
- **CORS/Origins**: Rejects websocket handshakes with mismatched Origin headers.

## 4. Verification Checklists (Deployment Verification Tests)
To verify the WSS server is operating correctly:
- [ ] Connect without token -> Connection rejected (HTTP 401/AuthRequired).
- [ ] Connect with expired/invalid token -> Connection rejected (HTTP 401/AuthFailed).
- [ ] Connect with valid session token -> Connection established.
- [ ] Submit move out-of-turn -> Rejected (OutOfTurn error).
- [ ] Submit illegal chess move -> Rejected (IllegalMove error).
- [ ] Submit legal chess move -> Accepted and board FEN updated.
- [ ] Terminal checkmate move submitted -> Match ended, ELO result signed with `RANKED_RESULT_HMAC_SECRET`.

## 5. Final Status
**MANUAL_PENDING**. Axum server deployment to production hosting is pending manual action.
