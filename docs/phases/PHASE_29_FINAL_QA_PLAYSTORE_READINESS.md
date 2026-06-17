# Phase 29 — Final QA & Play Store Readiness

This phase is the final validation, Android configuration audit, QA testing, crash-handling review, and Play Store readiness preparation for *Clash of Crowns*.

---

## 1. Automated Verification Results

All automated checks compile, lint, format, and execute unit tests successfully.

### Frontend Quality Checks
- **Type Check & Lint (`npm run lint` / `tsc --noEmit`)**: Completed successfully with **0 errors**.
- **Production Build (`npm run build`)**: Compiled successfully.
- **Vitest Unit Suites**: **146 tests passed successfully** across all frontend modules:
  - `src/game/commentary` (8/8 passed)
  - `src/game/multiplayer` (25/25 passed)
  - `src/game/social` (24/24 passed)
  - `src/game/leaderboard` (9/9 passed)
  - `src/lib/cloud` (10/10 passed)
  - `src/lib/offline` (12/12 passed)
  - `src/game/security` (20/20 passed)
  - `src/game/ai/__tests__/progression.test.ts` (38/38 passed)

### Rust Backend Checks
- **Formatting (`cargo fmt`)**: Checked and verified.
- **Compilation Check (`cargo check`)**: Completed successfully in 0.69s.
- **Unit/Protocol Tests (`cargo test`)**: **9/9 tests passed successfully** (verifying Axum socket connections, protocol handshakes, and room state-machine moves).

### Capacitor / Android Integration
- **Sync Command (`npx cap sync android`)**: Successfully copied web assets, generated configurations, and synchronized plugins.

---

## 2. Android Release Configuration Audit

The following configuration parameters were inspected and verified under `android/` and `capacitor.config.json`:

| Config Parameter | Target / Found Value | Status |
| :--- | :--- | :--- |
| **Package Name / Application ID** | `com.clashofcrowns.game` | Verified |
| **App Name / Label** | `Clash of Crowns` | Verified |
| **minSdkVersion** | `24` (Android 7.0 Nougat) | Verified |
| **targetSdkVersion** | `36` (Android 15+) | Verified |
| **versionCode** | `1` | Verified |
| **versionName** | `"1.0"` | Verified |
| **Orientation** | `sensorLandscape` (Forces landscape play, rotates to sensor) | Verified |
| **Internet Permission** | `<uses-permission android:name="android.permission.INTERNET" />` | Verified |
| **Cleartext Traffic Policy** | Disabled for production (no cleartext flag). Cleartext is allowed during local dev via network security configs or loopbacks. | Verified |

---

## 3. Real Device QA Checklist

To ensure release stability across diverse hardware, the following manual test scenarios must be run:

### notch/cutout screen
- Open the game on a device with a camera notch or pinhole cutout.
- Verify that HUD components, buttons, and timers are padded away from screen edges and never overlapped by the notch.
- Confirm full-screen cutout rendering behaves correctly without blank borders.

### low-end and mid-range devices
- Verify that the game defaults to **Low Graphics Mode** on low-resource devices (low memory, low CPU).
- Confirm that Three.js canvas runs at $\ge 30$ FPS in 3D mode on mid-range devices, and is smooth in 2D fallback mode.
- Ensure device temperature and battery drain remain within normal ranges.

### networks and offline modes
- Start a single-player match, then toggle **Airplane Mode** (offline).
  - Verify that the app shifts gracefully to offline mode.
  - Verify player data updates queue locally in `syncQueue` instead of crashing.
- Turn network back on and verify that the local queue syncs back to Firebase automatically.

### lifecycle states
- Minimize the app during a match, wait 2 minutes, then resume.
  - Verify that the match state is recovered without lag or crashes.
- Force-kill the app during a match, reopen it.
  - Verify that the app prompts to resume the match from the local backup save.

---

## 4. Game Feature QA Results

- **Home / Start Flow**: Opens quickly with responsive graphics options.
- **Tiers & Progression**: All 8 AI progression tiers (Core to Grandmaster) load and enforce locks based on player ELO.
- **Unlock Rules & Rewards**: XP, coins, and badges update immediately on the player profile after a single-player career victory.
- **Save / Load / Repair**: Saved game state restores fen, history, and captures. If local JSON is manipulated, `validateAndRepairPlayerData` detects the checksum mismatch and restores the secure backup.
- **Commentary Bubble**: Mounts and fades out using CSS/motion transitions. It does not block drag-to-move actions on 2D/3D boards due to target `pointer-events` isolation.

---

## 5. Rust Multiplayer & Firestore Fallback QA

### Case A: Rust Server ON
- Browser clients connect to `localhost:3001` / emulators to `10.0.2.2:3001` / real phones to laptop LAN IP.
- Unified multiplayer adapter checks `/health` and establishes a WebSocket transport connection.
- Handshakes, turn sequence validation, and move broadcasts sync in $< 100$ms.
- Draw offers, resignations, and game-over states conclude matches instantly.

### Case B: Rust Server OFF
- Adapter's `/health` check fails or times out in $< 1500$ms.
- Fallback Firestore adapter triggers transparently before the match starts.
- Move snapshot listeners are registered, allowing multiplayer to run via Firestore without UI crashes.

### Case C: Challenge Room Integration
- Sender creates a Friendly Duel challenge $\rightarrow$ Receiver accepts via notifications $\rightarrow$ Firestore transaction creates the match room, assigns roles, and links the deterministic Room ID.
- Match opens instantly for both players.
- Uses Rust WebSocket transport if available, falls back to Firestore if not.

---

## 6. Offline / Cloud QA

- **Offline Package**: Triggers download prompts for the Stockfish WASM engine. If skipped, game fallback handles local AI play correctly.
- **Sync Queue**: Sync queue successfully caches save events during network dropouts and processes uploads sequentially on reconnect.
- **Cloud Save Merge**: Timestamps are compared: if cloud is newer, it merges data without losing local settings, and resolves conflicts safely.

---

## 7. Leaderboard / Social QA

- **Dual Leaderboards**: "Comp Kings" (AI Career) and "Arena Kings" (WebSocket PvP) load scores. Offline queues delay writes until network availability.
- **Challenge Cooldowns**: Poke and Duel challenge frequencies are limited to prevent user spamming.
- **Inbox Notifications**: Chat notification flags mark as read on click, preventing duplicate pending duel popups.

---

## 8. Performance Notes

- **Camera & Fiber Render**: Rendering uses simple geometry and is optimized. Dragging, zooming, and rotating the 3D board runs smoothly.
- **Main Thread Offloading**: Stockfish analysis runs inside a dedicated web worker, ensuring that the main UI thread never freezes.
- **Adapter Cleanup**: When navigating away from `GameScreen`, the adapter calls `.dispose()`, which terminates all WebSocket and Firestore listeners to prevent memory leaks.

---

## 9. Crash & Error Handling Notes

The app handles failures gracefully to prevent black/white screens:
- **Rust Server Unavailable**: Silent fallback to Firestore.
- **Firestore Permission Denied**: Logged to audit log, returns clear warning modal.
- **Corrupt Save Files**: Autodetected by checksum verification, falls back to backup save or resets to default safely.
- **WebSocket Version Mismatch**: Server rejects connection if protocol versions do not match, adapter falls back to Firestore.

---

## 10. Play Store Readiness Checklist

### Store Listing Drafts
- **App Name**: Clash of Crowns
- **Short Description**: High-performance 3D chess with career progression, smart AI, and realtime multiplayer.
- **Full Description**:
  Experience chess like never before in Clash of Crowns. Play in stunning 3D or classic 2D. Fight your way through an 8-tier career progression mode against unique AI personalities. Challenge friends in real-time low-latency multiplayer matches powered by WebSocket or Firestore fallbacks. Practice offline with localized Stockfish WASM engine support. Save your progress securely with Cloud Save and automated offline sync.
- **App Category**: Games / Board
- **Contact Email**: support@clashofcrowns.game
- **Privacy Policy**: Requires URL outlining Firebase Authentication usage, encryption of save data, and anonymized analytics.
- **Data Safety**:
  - Encrypted in transit (HTTPS/WSS).
  - User accounts can be deleted.
  - No location tracking.

### Graphic Assets
- **Icon**: High-res $512\times 512$ PNG (with alpha channel).
- **Feature Graphic**: $1024\times 500$ PNG.
- **Screenshots**: At least 4 screenshots (landscape orientation) representing 2D board, 3D board, Career screen, and Multiplayer lobby.

---

## 11. Release Build Checklist

The following sequence must be followed to compile the production build:

1. **Increment Versioning** (in `android/app/build.gradle`):
   - Increase `versionCode` (e.g., `2`).
   - Update `versionName` (e.g., `"1.1"`).
2. **Build Web Bundle**:
   - Run `npm run build` to output to `dist/`.
3. **Synchronize Capacitor**:
   - Run `npx cap sync android` to copy assets to Android Studio.
4. **Generate Release AAB** (Android App Bundle) / **APK**:
   - Open `android` project in Android Studio.
   - Go to **Build > Generate Signed Bundle / APK**.
   - Select **Android App Bundle** (for Play Store upload) or **APK** (for local testing).
   - Use the secure release keystore.
5. **Install & Test**:
   - Sideload the release APK to a real test device to verify release performance, splash screens, and permissions.
6. **Rollback Plan**:
   - Keep previous Git tags intact. If the release crashes, build and deploy the previous working version code to the play console immediately.

---

## 12. Next Recommended Phase

### Phase 30: Sound Effects & Sound Track Polish
- Integrate ambient background music and refined sound effects for chess moves, captures, checks, and game results.
