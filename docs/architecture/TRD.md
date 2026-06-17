# Technical Requirements Document (TRD) - Clash of Crowns

## 1. Technical Stack (TECH_STACK)
The Clash of Crowns platform is designed as a hybrid full-stack web and mobile application.

*   **Frontend Library:** React 19.x with Vite (Type Safely enforced via TypeScript 5.x)
*   **3D Graphics Rendering:** Three.js, `@react-three/fiber` (R3F), and `@react-three/drei`
*   **Styling & UI Components:** Tailwind CSS (configured for instant custom utility mapping)
*   **State Management & Database Sync:** React standard hooks combined with custom local-first stores syncing client-side profiles directly to Firebase (Firestore v12.x) and Firebase Auth.
*   **AI Engine Tiers 0-3:** Hand-crafted TypeScript Chess Engine using custom Negamax algorithms
*   **AI Engine Tiers 4-5:** Stockfish 10 compiled to WebAssembly (WASM), communicating with the UI thread via background **Web Workers**
*   **Mobile Compilation:** Capacitor 8.x for native Android build abstraction
*   **Backend Server:** Node.js, Express framework, Socket.io (for future multiplayer signaling)
*   **Payment Services:** Stripe REST API and webhook listeners
*   **Animations:** Framer Motion (re-branded as `motion` under `motion/react`)

---

## 2. Infrastructure & System Architecture (ARCHITECTURE)

```
                       +----------------------------------+
                       |        3D Chess Client           |
                       | (React 19 / Vite / Tailwind)     |
                       +----------------+-----------------+
                                        |                   
                     +------------------+------------------+
                     |                  |                  |
           +---------v--------+  +------v-------+  +-------v--------+
           | Three.js Visuals |  | Custom Engine|  | Stockfish WASM |
           |  board & pieces  |  |  (Negamax)   |  | (Web Worker)   |
           +------------------+  +--------------+  +----------------+
                     |
                     |  SYNC DATA (Auth / Elo / Stats)
                     |
           +---------v------------------------------------+
           | Cloud Infrastructure Layer                   |
           | - Firebase Admin (Durable Sync)              |
           | - Express backend APIs (Stripe Proxy Server) |
           +------------------+---------------------------+
                              |
                     +--------v--------+
                     |  Firestore DB   |
                     |  (Memory Cache) |
                     +-----------------+
```

### Local-First Data Strategy
All chess logic is managed inside the browser and local sandbox.
1. Move validation is checked instantly using **chess.js**.
2. Positions are computed, and ratings are adjusted locally without making blocking network requests.
3. The adjusted rating or score is asynchronously submitted to Firestore. If the client is offline, Firestore buffers writes (using mem-only caches during session) and pushes them once online. This ensures a seamless, lag-free experience.

---

## 3. High Performance 3D & AI Pipelines

### A. The Custom AI (Tiers 0-3 / Levels 1-26)
*   **Unified Negamax Block:** Solves dual-recursive branch checking cleanly.
*   **Alpha-Beta Pruning:** Cuts off search branches early if a move is worse than the previously confirmed minimum.
*   **Incremental Evaluation:** Uses custom piece square coordinate adjustments to recalculate board scores step-by-step instead of scanning all 64 squares repetitively. This increases computation speeds up to **500%**.
*   **Zobrist Hashing & Transposition Cache:** Assigns stable 64-bit XOR identifiers to board squares to store millions of pre-computed positions in RAM.

### B. The Elite Engine (Level 27)
*   Integrates Stockfish 10 WASM directly in the static directory.
*   Spawns a specialized Web Worker thread to receive FEN strings, process positions, and return best Move coordinates without dropping frames from the animated 3D board scene.

---

## 4. Security & Robustness (SECURITY_NOTES)

### A. Environment Configuration & Secrets
*   All Google Cloud, Firebase, and Stripe secrets are maintained strictly server-side.
*   `firebase-applet-config.json` stores basic public configurations.
*   Sensitive Stripe APIs and authorization webhooks bypass direct client exposure, routing instead through Express proxy handlers (`/api/*`).

### B. Hardened Express Setup
*   **CORS (Cross-Origin Resource Sharing):** Enabled selectively to match expected client routes and Android native web views.
*   **Express Rate Limiter:** Protects APIs against aggressive crawler request floods.
*   **Helmet:** Generates strict headers. In particular, custom **Content Security Policy (CSP)** configurations are enabled:
    *   `frameAncestors` is configured to output `['self', 'https://aistudio.google.com', 'https://*.google.com', 'https://*.run.app']` to ensure successful iframe embedding in the AI Studio editor while maintaining robust protection against clickjacking.

### C. Client Storage Resilience
*   Firestore has been hardened against stream-level assertion failures (`Unexpected state ID: ca9/b815`).
*   It explicitly uses `memoryLocalCache()` and uses long-polling (`experimentalForceLongPolling: true`) to navigate complex sandbox restrictions in iframe previews.
