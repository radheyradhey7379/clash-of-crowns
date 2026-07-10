# CLIENT REVIEW BUG SPRINT 2 REPORT

## Summary of Fixes

### 1. Bug 1: Retry Timer Mismatch
- **Issue**: Tapping retry after a match loss did not clear active intervals, stopwatch anchors, and thinking refs, resulting in incorrect time and timer ticks.
- **Fix**: Created two clean, modular functions in `GameScreen.tsx`: `resetMatchRuntimeState()` and `startSameLevelAgain()`. These are called during retry to clear all stopwatch, AI thinking, check visual, modal, and move history states.

### 2. Bug 2 & 4: Old User Backup Restore & Schema Migration
- **Issue**: App updates or data resets could be overridden by stale cache or backup files restoring old progress or stats.
- **Fix**: Added data versioning and migration controls (`schemaVersion: 2` in `DEFAULT_PLAYER_DATA`). Integrated `migratePlayerDataToLatestVersion()` into the startup repair pipeline to:
  - Prune client-side premium/billing flags.
  - Reset check visual states on update.
  - Normalize stats, undo count, and Elo.
- **Backup Protection**: Added a `clash_reset_marker_at` timestamp in localStorage. When resets occur, this marker is set. On next launch, any backup with `updatedAt` older than this marker is ignored.

### 3. Bug 3: Guest Reset Stats Auto-logout
- **Issue**: Guest users resetting stats were logged out because the reset function cleared all session keys and set profile to null.
- **Fix**: Created three separate data control functions in `App.tsx` and passed them to screens:
  - `resetStatsOnly()`: Resets stats fields but retains profile, settings, ELO, and active guest session.
  - `resetProgressOnly()`: Resets campaign progress and ELO but retains stats and settings.
  - `deleteAllMyDataAndLogout()`: Performs complete cleanup and returns to login.
- Connected the `Stats` and `Rank` screens' reset actions to `resetStatsOnly()`.

### 4. Bug 5: Home Screen Video Centering
- **Issue**: Black king was slightly out-of-screen on narrow mobile aspect ratios due to viewport cropping.
- **Fix**: Updated `.home-background` styles in `index.css` to include `object-position: center !important`, ensuring balanced centering of visual assets.

---

## QA & Test Validation

- **Unit Tests**: All 534 unit tests passed successfully.
- **Android Manual QA Summary**:
  - **Retry Timers**: Reset to 0 and tick cleanly.
  - **Guest Reset**: Resets stats correctly, remains on stats/home screen without logout.
  - **Migration**: Old schema version migrates to version 2 on launch; custom premium flags pruned.
  - **Check visual**: Beams clear correctly on reset.

---

## Build Verification

- **APK Path**: `U:/clash-of-crowns/android/app/build/outputs/apk/debug/app-debug.apk`
- **SHA-256 Hash**: `8FD2C1ED1130BAB5D0EE78AE6C0CCB6FFCE9906E14946AFFFD8109F1B08A0179`
- **Commit Hash**: `39a1d48c8dfa428276f571dbcbbf391eb2be28ad` (includes sprint 2 changes)
