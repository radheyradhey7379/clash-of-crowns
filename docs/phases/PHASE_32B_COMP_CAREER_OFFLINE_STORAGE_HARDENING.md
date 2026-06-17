# Phase 32B: Comp Career Offline Storage Hardening

## Overview
This phase implements client-side tampering resistance and offline storage hardening for the Comp Career mode in Clash of Crowns v1.0. Given that the game functions primarily offline with lazy syncing, the local `localStorage` must resist basic tampering (e.g., manually editing JSON to unlock tiers, give infinite coins/XP, or fabricate match results) to protect leaderboard and cloud sync integrity.

## Key Implementation Details

1. **Suspicious Save Detector (`src/game/security/suspiciousSaveDetector.ts`)**
   - Implemented an external anomaly detection engine that flags suspicious player data before it reaches the repair logic.
   - Detects negative values, non-finite values, NaN, and impossible caps (e.g., > 10,000,000 coins).
   - Detects future timestamps (> 24 hours ahead) indicating clock manipulation.
   - Cross-checks progression integrity: e.g., unlocking `grandmaster` without having completed Master Cup 3, or unlocking `master` without having played at least 20 matches.
   - Flags range from `low` to `critical`. High/critical flags explicitly block the `shouldBlockCloudUpload` and `shouldBlockLeaderboardUpload` gates.

2. **Save Integrity Metadata (`src/types/index.ts`, `src/game/security/saveIntegrity.ts`)**
   - `PlayerData` now includes integrity metadata: `saveVersion`, `lastValidatedAt`, `lastRewardAt`, `lastMatchId`, `totalMatchesCompleted`, `integrityLevel` (either "legacy", "validated", or "suspicious_repaired"), and `suspiciousFlags`.
   - The `matchFlowService.ts` explicitly stamps the save with `lastMatchId` and updates the match count on every valid completion.

3. **Reward Anti-Duplication (`src/game/security/matchSessionGuard.ts`)**
   - Hardened `clash_completed_matches` cache to prevent attackers from corrupting the JSON array to bypass duplicate checks.
   - Validation now ensures it is an array of strings. If parsing fails, it safely resets to an empty array rather than erroring or bypassing the check.

4. **Storage & Backups Policy (`src/lib/protectedSave.ts`)**
   - Implemented a "previous-good" backup policy: Before overwriting the primary `clash_player_data` key, the previous save state is copied to `clash_player_data_backup`.
   - The backup is only restored if the primary save is unparsable or fails the checksum verification.
   - Ensures a valid backup is never blindly overwritten by a suspicious corrupted save.

5. **Cloud & Leaderboard Upload Protection (`src/lib/cloud/cloudSaveService.ts`, `src/lib/cloud/cloudConflictResolver.ts`, `src/game/leaderboard/compLeaderboardService.ts`)**
   - `uploadCompLeaderboardEntry` and the Cloud Save sync routines now execute `detectSuspiciousSave` on the outgoing payload. If flagged, the upload is quietly rejected/dropped (blocking illegitimate cloud syncs) while avoiding an aggressive local crash or data wipe.
   - `resolveCloudVsLocal` actively rejects remote Cloud Saves that possess future timestamps.

## Testing
- Added robust unit test coverage in `src/game/security/__tests__/suspiciousSaveDetector.test.ts` to ensure edge cases (e.g., negative coins, future clocks, impossible tier jumps) are correctly flagged.
- Updated `security.test.ts` to account for the new backup-policy constraints.
- Test Suite passed successfully (`173` tests passing).
- Run `npm run build`, `npm run security:scan`, and `cargo test --manifest-path src-rust/Cargo.toml` passed.

## Known Limitations & Future Work
- The current implementation relies on client-side checksums (`crypto-js` SHA-256) and heuristics. It is effective against amateur tampering, but advanced attackers can still reverse-engineer the client.
- **Future Phase:** Implement server-side HMAC-backed validation or full server authoritative state for Comp Career if real-money rewards are introduced.
