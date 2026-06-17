# Phase 12B QA Report: Android Mobile UI Scaling & Performance Optimization

This document outlines the design decisions, architectural modifications, and performance enhancements implemented during **Phase 12B** for *Clash of Crowns*.

---

## 1. Viewport & Background Stabilization

### Cutout & Black Strip Fix
*   **Android Custom styles**: Implemented `shortEdges` layout in both `styles.xml` (root) and `values-v27/styles.xml` to allow display layout inside camera cutout bounds in landscape mode.
*   **Edge-to-Edge Layout**: Integrated programmatic window configuration in `MainActivity.java` forcing decor views, status bars, navigation bars, and the WebView context to transparent and pure black backgrounds to eliminate transient borders.
*   **Container Locking**: Locked root layouts (`.screen-root`, `.home-screen`, `.main-menu-screen`) using `position: fixed`, `inset: 0`, and `overflow: hidden` to block scrolling offsets during taps.

### Optimized WebP Assets
*   **Optimized WebP conversion**: Generated lightweight static background WebP assets:
    *   `public/home-bg-mobile.webp` (793 KB PNG base converted to compressed WebP)
    *   `public/home-bg-desktop.webp` (Static desktop fallback when low graphics is active)
*   **Unified Background Engine**: Created `src/components/ui/ScreenBackground.tsx` to handle responsive background presentation:
    *   Always uses lightweight `home-bg-mobile.webp` on mobile platforms (Native or Web) to save RAM and GPU memory.
    *   On Desktop, automatically displays `.mp4` video background loops by default.
    *   On Desktop in **Low Graphics Mode**, falls back to static `home-bg-desktop.webp` to conserve power and CPU cycles.

---

## 2. Responsive UI Scaling System

*   **Tailwind CSS & CSS Clamp**: Standardized typography, dialog bounds, and spacing under `@theme` inside [index.css](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/index.css) using fluid scaling custom properties:
    *   `--font-title`: title scale clamps.
    *   `--font-heading`: headings scale clamps.
    *   `--font-body`: base texts scale clamps.
    *   `--font-small`: details/stats scale clamps.
    *   `--button-height`, `--button-radius`, `--icon-size`: components scaling.
*   **Landscape Viewport Rules**: Added landscape-specific media query targets (`max-width: 950px` and `orientation: landscape`) scaling overall UI properties down to a baseline factor of `0.72` on small viewports.
*   **Modal Audit**: Re-anchored game setups, promotion selections, pause menus, and game-over modals using the responsive `.play-popup` container bounds. It enforces standard max heights (`82dvh`) and scrollable bodies preventing off-screen overflows.

---

## 3. Game setup & Rendering Performance

### Non-blocking Game Loading Screen
*   **Layered Progress Loading**: Created `src/components/ui/GameLoadingScreen.tsx` which presents a themed progress bar and status statements during Three.js context initialization (e.g. *Preparing match*, *Loading board theme*, *Assembling pieces*, *Calibrating engine*).
*   **Model Initializers**: Integrated loading hooks in [GameScreen.tsx](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/components/screens/GameScreen.tsx) reporting exact progress milestones instead of presenting frozen frames.

### Three.js Optimization & 3D Visual Assets
*   **Fidelity Restoration**: Restored the complete 3D scene visuals (including the Room model, the table, environment map reflections, full light settings, and shadows) to render at 100% fidelity on both mobile and desktop.
*   **Targeted Low Graphics Mode**: Toggling Low Graphics mode (which defaults to `true` on first mobile boot and respects user choices permanently) is kept active for non-3D resources (e.g. replacing desktop video backgrounds with optimized WebP images) while keeping the 3D game battlefield fully intact and premium.
*   **Canvas Configuration**: Re-enabled antialiasing, high-quality PCFShadowMaps, and full device pixel ratios (`[1, 1.5]`) on the Canvas.
*   **Piece Meshes**: Piece models (Pawn, Rook, Knight, Bishop, Queen, King) render in full polygon count with all detailed sub-meshes (e.g., Rook battlements, Knight snout/eyes/mane, Queen coronet spheres) permanently visible.

### AI Calculations Offloading
*   **Negotiated Negamax Tiers**: Restricted internal Negamax search trees to Tier 0 (Beginner) characters where search depths are extremely shallow (1-5) and compute fast.
*   **Stockfish WASM Workers**: Routed Tier 1 (Intermediate) and Tier 2 (Grandmaster) computations to the Stockfish WASM Web Worker (`sf.js`). Since computations run on an asynchronous worker thread, they never block the main browser thread.

---

## 4. Enhanced Debug Overlay

*   **Extended Telemetry**: Upgraded `PerformanceOverlay` in [GameScreen.tsx](file:///c:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/components/screens/GameScreen.tsx) to print real-time platform metrics:
    *   **FPS**: Frame rate.
    *   **RTT**: Round-trip latency (ping).
    *   **Board Load Time**: Physical duration of canvas resource mounting.
    *   **AI Move Time**: Search latency for the last computed move.
    *   **Graphics Mode**: Active rendering profile (Low Graphics / High Quality).
    *   **Viewport Bounds**: Live window dimensions (width x height).
