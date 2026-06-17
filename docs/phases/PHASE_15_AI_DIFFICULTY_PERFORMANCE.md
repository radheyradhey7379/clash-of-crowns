# Phase 15 Documentation: AI Difficulty Scaling + Lag-Free Gameplay Optimization

This document outlines the changes, optimizations, and validations completed during Phase 15. The focus of this phase was to ensure natural difficulty progression while maintaining lag-free, responsive gameplay on lower-end devices and Android Capacitor.

---

## 1. AI Difficulty Scaling & Ranges

AI difficulty settings are retrieved dynamically via `getAIDifficultySettings(character)`. This mapping guarantees the following parameters are enforced per tier:

*   **Core**: Simple JS engine, depth 1, blunderRate 40–50%, maxThinkTimeMs = 300ms, moveDelayMs = 150ms.
*   **Beginner**: Simple JS engine, depth 1–2, blunderRate 25–35%, maxThinkTimeMs = 500ms, moveDelayMs = 250ms.
*   **Learner**: Simple JS engine, depth 2, blunderRate 15–25%, maxThinkTimeMs = 700ms, moveDelayMs = 350ms.
*   **Promotion Trial**: Stockfish Worker or simple JS engine, depth 2–3, blunderRate 12–18%, maxThinkTimeMs = 900ms, moveDelayMs = 450ms.
*   **Intermediate**: Stockfish Worker, depth 4–6, blunderRate 8–12%, maxThinkTimeMs = 1200ms, moveDelayMs = 600ms.
*   **Hard**: Stockfish Worker, depth 6–8, blunderRate 4–8%, maxThinkTimeMs = 1600ms, moveDelayMs = 800ms.
*   **Master**: Stockfish Worker, depth 8–10, blunderRate 2–4%, maxThinkTimeMs = 2200ms, moveDelayMs = 1100ms.
*   **Grandmaster**: Stockfish Worker, depth 10–12, blunderRate 0–2%, maxThinkTimeMs = 3000ms, moveDelayMs = 1500ms.

---

## 2. Stockfish Web Worker Lifecycle & Reuse

To maximize device performance, reduce battery drain, and prevent memory leaks:
*   **Single-instance Reuse**: A single Stockfish Web Worker instance is created and reused per match. The worker is not re-created on each move.
*   **Aggressive Cleanup**: The worker is terminated instantly via `stockfishService.terminate()` on:
    *   Match checkmate or draw (`checkGameOver` in `GameScreen.tsx`)
    *   Game reset (`resetGame`)
    *   Declared draws (`handleDeclareDraw`)
    *   Player resignation (`handleResign`)
    *   Navigation away from the game screen (`navigateWithCleanup`)
    *   Component unmounting (`useEffect` cleanup hook)

---

## 3. Max Think-Time Enforcement & Fallbacks

To prevent game freezes or indefinite thinking hangs:
*   **UCI Stop Command**: If Stockfish is still searching when `maxThinkTimeMs` is exceeded, we send the UCI `stop` command. Stockfish halts calculation and immediately responds with its current `bestmove` found.
*   **Safety Timeout**: An absolute safety timeout (set to `maxThinkTimeMs + 1000`) is established. If the worker hangs completely, the promise force-resolves to `null`.
*   **Graceful Fallback**: If the Stockfish worker resolves to `null` or throws an error, the game falls back to the internal minimax engine. If the internal search fails as well, the first available legal move (`chess.getMoves()[0]`) is played, ensuring the match never hangs.

---

## 4. AI Thinking Guard & Tap Protection

A strict `isAIThinking` state is implemented:
*   **Move Blocking**: While `isAIThinking` is `true`, players are blocked from selecting squares or making moves.
*   **Spam Protection**: Rapid click/tap protection filters out click/tap events within 200ms of each other.
*   **Safe Cleanup**: `isAIThinking` is reset to `false` in a try-finally block wrapping the entire move loop, guaranteeing input release.

---

## 5. Performance Metrics Debug Overlay

The `PerformanceOverlay` has been extended to display:
*   **AI Engine**: `SIMPLE` or `STOCKFISH`
*   **AI Depth**: Search depth (e.g. `4`)
*   **Max Think Time**: The millisecond limit (e.g. `1200ms`)
*   **Last Move Latency**: The exact calculation duration of the last AI move

*Note: All layout, styling, colors, and styling rules of the debug panel were strictly preserved.*

---

## 6. Verification & Automated Tests

A dedicated test suite `AI Difficulty Scaling & Performance (Phase 15)` was added to `progression.test.ts` to test:
1. Correct engine selected per tier.
2. `maxThinkTimeMs` fallbacks and ranges.
3. Custom think time and delay overrides.
4. Stockfish worker cleanup on termination.
5. Stockfish worker timeout fallback with UCI `stop` command.
6. AI thinking guard block behavior on user clicks.

All **34 tests** passed successfully. Linting and Capacitor Android sync have been completed successfully.
