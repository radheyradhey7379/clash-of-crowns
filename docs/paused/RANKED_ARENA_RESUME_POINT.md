# Ranked Arena Resume Point

## Completed Phases
- Phase 22: Dual Leaderboard (Comp & Arena)
- Phase 30: Ranked Arena Server Authority / Rust ELO Foundation

## Current Internal Working State
Rust server authority handles session validation, ELO computation, and deterministic verification hash generation. The frontend securely processes `verified_result` to update the Arena rating and leaderboard.

## Reason Disabled for v1.0
Ranked Arena requires a highly secure environment, full anti-cheat implementation (e.g. Shakmaty integration), and robust matchmaking services which are beyond the scope of the v1.0 offline/AI-focused release.

## Feature Flags Controlling It
- `VITE_ENABLE_RANKED_ARENA=false`

## Files Involved
- `src/components/screens/LeaderboardScreen.tsx`
- `src/game/leaderboard/arenaRankedService.ts`

## Code Markers
Search the codebase for: `START_HERE_RANKED_ARENA_RESUME` and `RANKED_ARENA_PAUSED_FOR_V1`.

## Next Steps to Resume
1. Change `VITE_ENABLE_RANKED_ARENA` to `true`.
2. Fully implement Shakmaty move validation and checkmate verification on the Rust server.
3. Hook up a matchmaking queue system for Arena players.

## Required Security Conditions Before Enabling Publicly
- Ensure the rating is fetched securely from Firestore/Admin SDK rather than relying solely on the frontend Auth payload.
- Anti-cheat logic (Stockfish analysis detection) must be in place.

## Test Commands
```bash
npx vitest run src/game/leaderboard
cd src-rust && cargo test
```
