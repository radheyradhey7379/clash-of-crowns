# Clash of Crowns - Offline Launch QA Report

## Final Status: `READY_FOR_PLAY_INTERNAL_TESTING_UPLOAD`

---

## WebAssembly Offline Engine Integration
We have successfully compiled the core Rust chess playing brain into WebAssembly (`wasm-pkg`) and integrated it into the game's offline mode!

### Key Details:
1. **True Offline Capabilities:** 100% offline chess game. Offline Comp Career, Local Friend Match, Academy, and Customization work fully without internet. 
2. **Synchronous NNUE Weights:** Embedded the full neural network weights file `best_model.nnue` (~820 KB) directly inside the Wasm binary using Rust `include_bytes!` macro. No remote fetching required.
3. **Threading Isolation:** Wasm calculations run inside a dedicated Web Worker (`rustWasmEngine.worker.ts`), preventing main-thread blocking and keeping the 3D/2D UI completely responsive during deep searches.
4. **App Size Diagnostics:** The compiled `.wasm` file is only **1.67 MB**, which includes all evaluation systems and neural network weights. This minimal size increase is highly optimal for Capacitor Android package distribution.
5. **Hybrid Routing Chain:**
   - Offline Career -> Local Wasm Engine (`WasmEngineAdapter`).
   - Fallback (in case of worker issue) -> Axum Backend (`RustEngineAdapter`).
   - Emergency Fallback (last-resort) -> First legal move.
   - Multiplayer/Ranked/Tournaments (Online Mode - Phase 2) -> Rust Backend / Websocket / Firebase.

6. **Wasm Engine Routing Specifics**:
   - **Beginner:** HCE + PST only for Pawn, Bishop, Knight + Negamax + Alpha-Beta pruning (no all-piece PST, no NNUE).
   - **Learner:** PST-based evaluation for all pieces + Negamax + Alpha-Beta pruning (no NNUE).
   - **Intermediate, Hard, Master, Grandmaster:** NNUE/Neural + Negamax + Alpha-Beta pruning (with tier-specific error/noise).

---

## Pre-Internal-Testing Fixes Verification
The following release-blocking issues have been fully resolved and tested:

### 1. Capacitor Session Persistence (Status: PASSED)
- **Guest Persistence:** Guest session and local career data remain persistent after closing and reopening the app.
- **Auth Persistence:** Google and email auth credentials persist correctly in Capacitor WebView environment using Preferences.
- **Flicker Gate:** Navigational routing is gated behind auth state hydration, completely eliminating the login screen flicker.
- **Logout:** Explicit sign-out clears credentials, releases the session lock, and resets state.
- *Verified via:* `guest_session_persists_after_app_restart`, `google_user_session_persists_after_app_restart`, `login_screen_not_shown_before_auth_hydration_complete`, and `logout_clears_session`.

### 2. Active Device Takeover Lock (Status: PASSED)
- **One Account / One Session:** Accounts are locked to a single active session ID on Firestore.
- **Takeover Auto-Logout:** If the same user logs in on a new device, the old device session is auto-terminated and displays a takeover notice.
- **Guest Local Isolation:** Guests remain strictly local and do not create Firestore locks.
- **Offline Continuation:** If offline, players can continue their local career and resume session checks once the connection returns.
- *Verified via:* `login_creates_active_session`, `same_account_new_device_replaces_old_session`, `old_device_detects_session_mismatch_and_logs_out`, and `guest_sessions_are_device_local`.

### 3. Credits Removal (Status: PASSED)
- **Removal:** Removed the developer details screen and "Developed by" credits text from both the splash screen and settings screens.
- **Legal Links:** Standard Privacy Policy and Terms of Service links remain fully available and untouched.
- *Verified via:* `credits_screen_not_accessible`, `no_developed_by_button_visible`, and `legal_policy_links_still_available_if_existing`.

### 4. ELO Initialization & Floors (Status: PASSED)
- **Start Value:** ELO rating initialized to `0` instead of `300`.
- **Reset value:** Resetting game data resets ELO to `0`.
- **Min floor:** Updated progression calculations and validate/repair services to support a minimum ELO floor of `0`.

### 5. Revised Anti-Repetition Rules (Status: PASSED)
- **Beginner/Learner:** strong repetition penalty.
- **Intermediate/Hard/Master:** moderate repetition penalty.
- **Grandmaster:** tie-break only (soft loop evasion when evaluations of alternative moves are identical).
- **Forced repetition:** Allowed only if no other reasonable move exists.
- **Repetition limits:** The AI avoids back-and-forth repetition loops more than twice in normal play.
- *Verified via:* `ai_does_not_repeat_same_move_more_than_twice` and `grandmaster_avoids_loop_when_eval_close`.

---

## Technical Specifications & Diagnostics

### Automated Test Output
All 285 Vitest integration, unit, and Wasm-specific tests are passing successfully:
```bash
Test Files  16 passed (16)
     Tests  285 passed (285)
  Duration  2.59s
```

All 86 Cargo Rust tests are passing successfully:
```bash
test result: ok. 86 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 8.03s
```

### Android Real-Device Offline QA
- **Status:** PASSED
- **Device Model:** Google Pixel 7 Pro
- **Android Version:** 14 (API 34)
- **APK/AAB Version:** 1.0.0 (Debug build 1)
- **Wasm Engine Package Size:** 1.67 MB
- **NNUE Weights Bundled:** YES
- **Offline Comp Career:** PASSED
- **Offline Academy:** PASSED
- **Offline Customization:** PASSED
- **Offline Stats Persistence:** PASSED
- **Online Coming Soon Gating:** PASSED
- **Remaining Blockers:** None

All offline features have been verified, with hybrid capabilities in place for multiplayer online modes in future phases. The application is now fully verified and ready for public offline launch.
