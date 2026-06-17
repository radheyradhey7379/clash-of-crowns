# Rust Realtime Resume Point

## Completed Phases
- Phase 25: Rust Realtime Backend Foundation
- Phase 26: Firestore to Rust Migration

## Current Internal Working State
Rust backend supports realtime WebSocket connections for Friend Matches, replacing Firestore as the primary transport. It correctly handles player presence, move synchronization, and health checks.

## Reason Disabled for v1.0
Rust infrastructure is robust but requires continuous server hosting and thorough performance testing before mass rollout. For the v1.0 launch, the focus is placed on a completely offline-ready, serverless experience.

## Feature Flags Controlling It
- `VITE_ENABLE_RUST_REALTIME=false`

## Files Involved
- `src/game/multiplayer/realtimeMultiplayerAdapter.ts`
- `src/game/multiplayer/rustRoomBridge.ts`
- `src-rust/` (Backend codebase)

## Next Steps to Resume
1. Change `VITE_ENABLE_RUST_REALTIME` to `true` in your `.env` file.
2. Deploy the Rust backend to a production environment.
3. Update `VITE_REALTIME_HTTP_URL` and `VITE_REALTIME_WS_URL` to point to the production server.

## Required Security Conditions Before Enabling Publicly
- Restrict `CorsLayer::permissive()` in `src-rust/src/main.rs`.
- Enable wss:// (TLS) for WebSockets.

## Test Commands
```bash
npx vitest run src/game/multiplayer
cd src-rust && cargo test
```
