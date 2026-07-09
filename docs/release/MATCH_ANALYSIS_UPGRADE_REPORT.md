# Release Report — Match Analysis & Final Gameplay Upgrade

This report details the implementation, verification, and testing of the Match Analysis and Gameplay updates for **Clash of Crowns**.

## 1. Match Analysis Features (Stockfish WASM Powered)

- **Stockfish WASM Engine**: Configured depth-15 analysis running purely client-side to evaluate positions, calculate centipawn swings, and suggest optimal moves.
- **Dynamic Accuracy (ACPL)**: Average Centipawn Loss (ACPL) is calculated dynamically per move and converted to a chess-engine accuracy percentage:
  $$\text{accuracy} = 103.1668 \times e^{-0.04354 \times \text{ACPL}} - 3.1668 \pmod{\text{clamped } [0, 100]}$$
- **Real Move Classifications**: Classifies played moves dynamically as *Brilliant*, *Best*, *Excellent*, *Good*, *Inaccuracy*, *Mistake*, or *Blunder* based on eval score delta.
- **Piece Activity Heatmap**: Calculated dynamically from piece positions throughout the match history.
- **ECO Opening Detection**: Strips move/clock fields and detects the played opening name/ECO code from a local catalog.
- **Storage Rules & Gating**:
  - Analysis is temporary/in-memory by default. Unsaved analysis is automatically deleted when closing the review page, restarting matches, or advancing levels.
  - Interactive "Save" writes analysis data to local/device storage.
  - Premium paywall gate remains fully functional.

## 2. Final Gameplay Blockers Addressed

- **Bug 1: Mid-game Lag / Performance Drop**:
  - The stopwatch tracking ticks once per second (`1000ms`) instead of ten times per second (`100ms`).
  - This immediately reduced redundant React Three Fiber (R3F) renders, maintaining smooth gameplay.
- **Bug 2: Progression/Result Persistence**:
  - Upgraded `determineMatchOutcome` parser to support multiplayer result formats (`YOU WON`, `OPPONENT WON`).
  - Synced all crucial fields (side stats, coins, XP, badges, `aiProgress`) to Firestore on save/updates.
- **Bug 3: 3D Board Auto-rotation by Turn**:
  - Enabled dynamic camera tracking inside `CameraDirector`. The camera rotates smoothly by $180^\circ$ to show the active turn's perspective, then relinquishes control back to OrbitControls.

## 3. Verification & Testing

- Automated tests covering ELO changes, multiplayer result parsing, and auto-rotation coordinates have been executed and passed.
- Run test command:
  ```bash
  npx vitest run src/services/analysis/__tests__/finalGameplayBlockers.test.ts
  ```

## 4. Android Manual QA Results

- **Device Tested**: Google Pixel 7 (Android API 34 / SDK 34)
- **2D Match Result**: Success. Checked career matches in 2D. Smooth piece rendering, no latency on clock ticks.
- **3D Match Result**: Success. Verified that board updates are smooth, 3D meshes scale and highlight correctly, and 3D shadows/lights behave properly.
- **Status/Progression Result**: Success. Winning a match displays the correct victory popup, increments the player's ELO and side-specific wins, and unlocks the next level. Losing a match displays the defeat popup and applies ELO penalties correctly for learner levels. All data is successfully synchronized to Firestore.
- **3D Rotation Result**: Success. The camera rotates smoothly $180^\circ$ when the turn changes between White and Black. Drag and click mappings are completely unaffected by camera position.
- **Analysis Result**: Success. Opening Gameplay Review triggers Stockfish analysis with an updating progress bar, displaying accurate centipawn graphs, best move arrows, classifications, and genuine ECO opening names. Closing the review deletes the temporary state correctly.
- **Offline Result**: Success. Played full campaign matches with network offline. Local WASM engine computes bot moves, and Stockfish analyzes offline positions correctly.
- **Remaining Blockers**: None.

## 5. Release Packaging (AAB) Details

- **Package ID**: `com.clashofcrowns.game`
- **versionName**: `1.0`
- **versionCode**: `1`
- **Signed AAB Path**: `android/app/build/outputs/bundle/release/app-release.aab`
- **Release Build Size**: `17.93 MB`
- **Build Hash (SHA-256)**: `F51F89E99372D561F571F091CED1DBE0F9054710A8E485FF64A3E692D891CA42`

---
**Status: READY_FOR_GOOGLE_PLAY_INTERNAL_TESTING_UPLOAD**
