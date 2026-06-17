# Phase 30: Ranked Arena Server Authority / Rust ELO Foundation

## Goal
Make the game feel secure and Arena ranked results trusted by implementing Rust server authority.
Rust validates ranked match sessions, calculates ELO, generates verified result hashes, and the frontend updates the leaderboard only when receiving a verified result.

## Completed Tasks
- Defined `RoomMode` (`Friend`, `RankedArena`) and updated `RoomState` with ranked metadata.
- Implemented `RankedMatchState` and `RankedResult` structures in Rust.
- Created `elo.rs` with `calculate_elo_change` (K=32, Floor=100) and verified with unit tests.
- Created `ranked_guard.rs` with necessary anti-cheat/sanity checks.
- Created `ranked_result.rs` for finalization logic and deterministic verification hash generation.
- Updated `connection.rs` to handle `SubmitResult` and emit `VerifiedResult` or `ResultError`.
- Updated `PlayerData` interface to include `arenaRating` and set default `arenaRating: 1200`.
- Added security validation and repair logic for `arenaRating` in `validatePlayerData.ts`.
- Implemented `arenaRankedService.ts` for session and verification logic.
- Updated leaderboard services (`arenaLeaderboardService.ts`, `leaderboardScore.ts`) to use dynamic `arenaRating`.
- Updated `realtimeModeTypes.ts` to include new server message types (`VerifiedResult`, `ResultError`) and room mode states.
- Finalized `realtimeClient.ts` to handle the new `Auth` rating input and `ranked_arena` mode.
- Updated `realtimeMultiplayerAdapter.ts` to wire the new messages without disrupting existing `Friend Match` transport.
- Implemented missing frontend unit tests for leaderboard verification, ELO update isolation, and adapter message handling.
- Successfully passed all frontend and Rust backend unit tests.

## Important Notes
- Frontend Auth rating is not trusted production authority. For Phase 30, Rust accepts rating from Auth as a dev/local input, but production should fetch rating from a trusted backend/Admin/Firebase source.
- Verified result deduplication is added: Frontend tracks applied verified result IDs to ensure Arena rating is never updated twice.
- ELO updates strictly require a verified Rust ranked result.
- Arena ELO floor is safely enforced at 100.
