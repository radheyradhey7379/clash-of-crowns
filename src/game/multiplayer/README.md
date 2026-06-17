# Multiplayer Module

This folder contains the core logic for the online multiplayer Friend Match system.

## Purpose
Manages multiplayer lobbies, turn-based move synchronization, draw offers, resignations, and connection heartbeats/reconnections.

## Key Files
- `multiplayerRoomService.ts`: CRUD operations on rooms in Firestore.
- `multiplayerMoveService.ts`: Firestore move submissions and subscriptions.
- `multiplayerDrawService.ts`: Firestore draw offering, decline, and acceptance.
- `multiplayerResultService.ts`: Game outcome validation and Firestore persistence.
- `realtimeMultiplayerAdapter.ts`: Orchestrates choice between Rust WebSockets and Firestore fallback.
- `rustRoomBridge.ts`: Relays and translates Rust WS server actions.
- `realtimeModeTypes.ts`: Type mappings for connections, moves, and message events.

## Related Phase Documentation
- `docs/phases/PHASE_20_MULTIPLAYER_FOUNDATION.md`
- `docs/phases/PHASE_21_MULTIPLAYER_MATCH_POLISH.md`
- `docs/phases/PHASE_26_FIRESTORE_TO_RUST_MIGRATION.md`

## Test Command
```bash
npx vitest run src/game/multiplayer
```

## Do-Not-Break Notes
- Always check `realtimeMultiplayerAdapter` fallback scenarios before submitting.
- Never listen to both Rust WS and Firestore simultaneously for the same room.
