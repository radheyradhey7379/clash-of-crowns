# Latency Badge Fix

This document covers the changes made to measure true game play latency and handle server connection states.

## 1. RTT (Round Trip Time) Calculation
Modified `src/services/realtime/realtimeClient.ts` to:
- Track `lastPingTime = Date.now()` immediately before sending a WebSocket heartbeat.
- Handle `type: 'pong'` messages returned from the Rust Axum WebSocket server.
- Calculate RTT (`Date.now() - lastPingTime`) in milliseconds.
- Propagate the updated value through `onLatencyCallback(rtt)`.
- Reset latency state and trigger `onLatencyCallback(null)` on socket disconnect or connection closure.

## 2. UI Status Display
Modified `src/components/screens/GameScreen.tsx` to subscribe to the connection status and latency updates, displaying the following states in the RTT badge:
- **Connecting**: Shows `"Waking server..."` (ignoring cold-starts as gameplay latency).
- **Reconnecting**: Shows `"Reconnecting..."` if the socket is reconnecting.
- **Offline**: Shows `"Offline"` if the socket drops or fails.
- **Real latency**: Shows `${rtt}ms` (color coded: green `< 100ms`, yellow `100-250ms`, red `> 250ms`).
- **Stale connection detection**: If no pong message has been received for > 10 seconds since the last pong, the badge transitions to `"Reconnecting..."`.
