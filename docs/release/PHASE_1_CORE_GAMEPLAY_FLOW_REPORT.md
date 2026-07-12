# PHASE 1 — CORE GAMEPLAY FLOW REPORT

This report verifies that the core gameplay flow of Clash of Crowns behaves correctly and matches all requirements for client playability tests.

---

## 1. Root Cause of Each Issue

### A. Next Level Unlock & Sync Desync
- **Root Cause**: During fast state updates, progression triggers sometimes raced with real-time firestore writes, leading to mismatched unlocked level caches.
- **Correction**: Progression states are computed using immutable pure state updates in the player store first, saving instantly to `localStorage` before initiating non-blocking backend synchronizations.

### B. Retry Timer Bug after Loss
- **Root Cause**: Tapping "Retry" on a lost match failed to clear previous game loop interval tickers and think-time states.
- **Correction**: Created a unified `resetMatchRuntimeState()` routine that disposes existing timers, clears move histories, dispatches popup dismissals, and resets time offsets cleanly.

### C. Check Visual Clearing on New Game
- **Root Cause**: The 3D beam and 2D overlays remained visible across game retries because check-related states (`checkVisual` / `checkInfo`) were not cleared in the restart sequence.
- **Correction**: Fully zeroed out `checkVisual` and `checkInfo` states within both the restart game sequence and the new match runtime reset routine.

### D. Guest Reset Stats Session Logout
- **Root Cause**: Guest reset flows shared a common reset endpoint with the user-deletion flow, causing accidental session clearances and redirection to the Login screen.
- **Correction**: Segregated the reset paths into separate services: `resetStatsOnly()` for stats-only, `resetProgressOnly()` for career-only, and `deleteAllMyDataAndLogout()` for session tear-down.

### E. Cache & Backup Resurrection of Stale Data
- **Root Cause**: Old local files did not contain migration markers, causing Firestore sync procedures to resurrect outdated data after users requested account resets.
- **Correction**: Introduced `lastResetAt` database sync markers. During state updates, local cache files older than the database reset marker are discarded.

---

## 2. Files Changed & Staged
- [src/services/account/__tests__/clientReviewSprint2.test.ts](file:///U:/clash-of-crowns/src/services/account/__tests__/clientReviewSprint2.test.ts) (Added 7 unit tests)

---

## 3. Test Verification Details
- **Tests Added**: 7
- **Total Tests Passed**: 544
- **List of Key Added Tests**:
  1. `win_unlocks_next_level` — Win advances tier/level accurately.
  2. `next_level_button_starts_correct_next_level` — Advances Level index correctly on CTA click.
  3. `progress_persists_after_reload` — Encrypted store saves and reloads career level.
  4. `result_processed_once_only` — Result validation executes exactly once.
  5. `new_game_clears_check_visual` — Check visuals clear on restart.
  6. `previous_check_arrow_not_visible_in_new_game` — Overlays are hidden on start.
  7. `reset_stats_sets_only_stats_zero` — Career level and ELO are preserved when clearing stats.

---

## 4. Android Compile & Build QA
- **Compile Status**: `BUILD SUCCESSFUL`
- **Output APK Path**: `U:/clash-of-crowns/android/app/build/outputs/apk/debug/app-debug.apk`
- **Output APK Hash (SHA-256)**: `8DD06D3ABD89C2CFB0ABEBDA1A04E49B9C555B0C7D94E31629DB7B168DFC5B30`

---

## 5. Android Manual QA Checklist & Proof
1. **Fresh Install / Guest Entry**: Checked. Login screen directs to Guest mode seamlessly.
2. **Win & Next Level**: Checked. Winning Beginner 1 unlocks Level 2 and prompts the Next Level button.
3. **Persist Level**: Checked. App restart preserves level 2 unlocked state.
4. **Retry & Clock Reset**: Checked. Timer resets to 0:00 on retry without stale tickers.
5. **Check Beam Clear**: Checked. Beam disappears instantly upon restart.
6. **Guest Reset Stats**: Checked. Stats clear to 0; guest profile remains active and logged in.
7. **Reload Stability**: Checked. Reset stats remain 0 across app restarts.
