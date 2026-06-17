# Live Tournament E2E Test Report

This report outlines the end-to-end testing scenarios required to verify the server-authoritative bracket-based tournament system.

## 1. Test Setup Configuration
- **Host**: Node.js tournament endpoints.
- **Testers**: 4 separate authenticated tester accounts (A, B, C, D) to form a minimal 4-player tournament bracket.

## 2. E2E Test Execution Matrix

### Phase A: Registration & Bracket Generation
- [ ] **Registration**: All 4 players register via `/api/tournaments/register`. Status updates to `Registered` in the UI.
- [ ] **Bracket Generation**: Administrator triggers `/api/tournaments/start` -> Server generates a 4-player tree (Round 1: A vs B, C vs D). Client UI renders the brackets.

### Phase B: Match Execution
- [ ] **Game Launch**: Matchups are initiated. Players launch their games from `TournamentScreen.tsx`.
- [ ] **No Client-side Override**: Player A attempts to advance their bracket by posting a fake result -> Rejected (Node requires verified Rust signature or authoritative server determination).
- [ ] **Authoritative Progress**: Player A wins match -> Backend updates bracket state, advancing A to the Finals.

### Phase C: Finalization & Rewards
- [ ] **Final Match**: Player A plays Player C in the Finals -> Match resolves.
- [ ] **Rewards Allocation**: Winner is crowned and receives reward coins/XP directly on the server -> Client-side attempts to double-claim are blocked.
- [ ] **Disconnect Handling**: Player B disconnects during match -> Match is auto-resolved in favor of Player A after the reconnect timeout expires.

## 3. Final Status
**MANUAL_PENDING**. Requires a coordinated run with multiple testers on live servers.
