# Live Ranked Arena E2E Test Report

This report outlines the end-to-end testing scenarios required to verify the server-authoritative Ranked Arena matchmaking, ELO calculations, and signature verification.

## 1. Test Setup Configuration
- **Player A**: ELO 1200.
- **Player B**: ELO 1210.
- **Authentication**: Both players logged in with valid Firebase accounts and short-lived session tokens.

## 2. E2E Test Execution Matrix

### Phase A: Queue & Matchmaking
- [ ] **Queue Entry**: Player A and Player B enter the Ranked queue.
- [ ] **Pairing**: Rust backend matches both players and spins up a `RankedArena` room.
- [ ] **Board Launch**: Both players' screens transition to the game screen automatically.

### Phase B: Auth Verification
- [ ] **Move Legality**: Moves are validated server-side by Rust via `shakmaty`.
- [ ] **No Client-side Manipulation**: Client attempts to submit a spoofed win result -> Rejected (server validates legality of current FEN and move history).

### Phase C: Result Verification & Persistence
- [ ] **Checkmate Finalization**: Player A checkmates Player B -> Rust flags match termination.
- [ ] **ELO Calculation**: Rust backend computes ELO deltas (e.g. White +15, Black -15).
- [ ] **HMAC Signature**: Rust generates a SHA-256 HMAC of the result payload using `RANKED_RESULT_HMAC_SECRET`.
- [ ] **Server Application**: Frontend calls `/api/ranked/verify-and-apply` with the signed payload. Node.js backend verifies the signature and commits the ELO update to Firestore using the Admin SDK.
- [ ] **Rules Check**: Client attempts to write directly to `/users/{uid}/rating` -> Blocked by Firestore rules.
- [ ] **Leaderboard Update**: Leaderboard `arena_kings` updates securely.

## 3. Final Status
**MANUAL_PENDING**. Requires live matchmaking runs and server validation.
