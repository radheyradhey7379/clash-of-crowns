# Live Friend Multiplayer E2E Test Report

This report outlines the end-to-end testing scenarios required to verify the peer-to-peer multiplayer room lifecycle using two distinct player accounts.

## 1. Test Setup Configuration
- **Player A (Host)**: Authenticated user on Device 1.
- **Player B (Guest)**: Authenticated user on Device 2.
- **Environment**: Deployed staging/production servers.

## 2. E2E Test Execution Matrix

### Phase A: Match Establishment
- [ ] **Create Room**: Player A clicks "Play Friend" -> Room created with code (e.g. `FR-12345`). Status set to `Waiting`.
- [ ] **Join Room**: Player B inputs the code `FR-12345` -> Joins successfully. Status transitions to `Ready`.
- [ ] **Ready Up**: Both players click "Ready" -> Room status transitions to `Active`. White/Black colors are assigned.

### Phase B: Gameplay Sync
- [ ] **Turn Enforcement**: White submits first move -> Synced. Black tries to move before White -> Rejected (OutOfTurn).
- [ ] **Illegal Move**: Player tries to move their Rook through another piece -> Server rejects (IllegalMove), board resets to previous legal FEN.
- [ ] **Draw Offer**: Player A clicks "Offer Draw" -> Dialog appears on Player B's screen. Player B declines -> Match continues.
- [ ] **Resignation**: Player A clicks "Resign" -> Match immediately terminates. Player B wins.

### Phase C: Reconnection & Cleanup
- [ ] **Disconnect**: Player A force-closes app -> Rust backend marks Player A as disconnected. Room remains active.
- [ ] **Reconnect**: Player A reopens app and rejoins -> State is reconstructed; game resumes.
- [ ] **Room Teardown**: Both players leave room -> Room record cleaned up from Rust memory.

## 3. Test Device Coverage
- **Device A**: physical Android Phone (Android 14+)
- **Device B**: physical Android Phone or Chrome Browser

## 4. Final Status
**MANUAL_PENDING**. Live multi-device testing must be conducted on the deployed servers.
