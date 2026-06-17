# Rust Realtime Multiplayer Backend

High-performance WebSocket server built with **Axum** and **Tokio** to coordinate low-latency chess match synchronization.

---

## 1. Environment Configurations

Create a `.env` file inside `src-rust/` containing:
```ini
PORT=3001
HOST=0.0.0.0
DEV_MODE=true
```

Ensure the React frontend has matched configurations:
```ini
VITE_ENABLE_RUST_REALTIME=true
VITE_REALTIME_HTTP_URL=http://localhost:3001
VITE_REALTIME_WS_URL=ws://localhost:3001/ws
```

For Android emulators, use `10.0.2.2` instead of `localhost` in the frontend `.env`.

---

## 2. API Endpoints

### HTTP Health Checks
- **`GET /health`**: Returns `{"status": "ok", "service": "clash-realtime"}`. Used by the frontend adapter to check availability.
- **`GET /version`**: Returns service details and protocol versions.

### WebSockets Route
- **`GET /ws`**: Upgrade route to initiate real-time socket connections.

---

## 3. WebSocket Protocol Summary

All messages are JSON objects matching snake_case naming and tagged by their `type`.

### Client to Server Messages
1. **`auth`**: Connect/authenticate. Must be the first message.
   `{"type": "auth", "uid": "...", "display_name": "...", "token": null, "protocol_version": "1.0.0"}`
2. **`create_room`**: Host creates match coordinates.
   `{"type": "create_room", "room_id": "CH-1234", "mode": "friend"}`
3. **`join_room`**: Guest joins the room.
   `{"type": "join_room", "room_id": "CH-1234"}`
4. **`player_ready`**: Sets ready state.
   `{"type": "player_ready", "room_id": "CH-1234"}`
5. **`submit_move`**: Sends move info.
   `{"type": "submit_move", "room_id": "...", "move_number": 1, "from": "e2", "to": "e4", "promotion": null, "fen_after": "...", "san": null}`
6. **`offer_draw`** / **`respond_draw`** / **`resign`**: Relays draw and resignation events.
7. **`heartbeat`**: Heartbeat verification. Runs every 10 seconds.

### Server to Client Messages
- **`auth_ok`**: Confirms connection authentication.
- **`room_created`** / **`room_joined`**: Confirms lobby registration.
- **`room_state`**: Broadcasts the status, FEN, turn, and players.
- **`move_accepted`**: Echoes confirmed move to sender.
- **`opponent_move`**: Relays move to receiver.
- **`opponent_disconnected`** / **`opponent_reconnected`**: Updates presence during dropouts.
- **`match_ended`**: Signals match results.
- **`pong`**: Confirms heartbeat.

---

## 4. Run & Test Commands

### Run Development Server
```bash
cargo run
```

### Run Formatting Check
```bash
cargo fmt -- --check
```

### Run Code Check
```bash
cargo check
```

### Run Unit Tests
```bash
cargo test
```

## Do-Not-Break Notes
- Keep protocol version at `"1.0.0"`.
- Do not bypass authentication; it must be the first message processed.
