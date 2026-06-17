# Realtime Client Service

This folder contains the WebSocket client managing communication with the Rust backend.

## Purpose
Maintains active WebSockets, pings heartbeats, decodes message packets, manages reconnect intervals, and sets fallback states if the server is offline.

## Key Files
- `realtimeClient.ts`: Class implementation for WebSocket pings and event handlers.

## Related Phase Documentation
- `docs/phases/PHASE_25_RUST_REALTIME_BACKEND.md`
- `docs/phases/PHASE_26_FIRESTORE_TO_RUST_MIGRATION.md`

## Do-Not-Break Notes
- Heartbeat must run every 10 seconds.
- WebSocket must automatically attempt reconnect on close/failure.
