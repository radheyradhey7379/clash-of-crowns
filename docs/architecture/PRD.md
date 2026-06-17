# Product Requirements Document (PRD) - Clash of Crowns: Grandmaster Edition

## 1. Project Vision & Purpose (PROJECT_VISION)
**Clash of Crowns** is designed to be the ultimate digital chess platform. By combining a beautiful and seamless 3D rendering engine (local-first, fully orbital) with a highly scalable, multi-tier artificial intelligence engine (ranging from Beginner 300 Elo to Master 2800+ Elo), Clash of Crowns bridges the gap between casual gamers, progressive learners, and seasoned chess veterans.

The target is to create an immersive chess ecosystem that operates on Web browsers and integrates into Android native packages (via Capacitor).

---

## 2. Product Principles (PRODUCT_PRINCIPLES)
Clash of Crowns adheres to three core product pillars:
1. **Visual & Immersive Excellence:** Chess is not just dynamic; it is aesthetic. A dynamic 3D board utilizing ambient lighting, realistic texturizing (wood, marble, neon), and soft orchestral backing tracks immediately converts static matches into highly engaging, cinematic experiences.
2. **Accessible Progression & Progression-Friendly AI:** Modern chess apps are often too intimidating or lack a granular sense of scale. Through a 27-level tier system ranging from Apprentice levels to Grandmaster performance, players compete against an AI companion that closely simulates real human play styles, errors, and positional concepts.
3. **Local-First with Cloud Sync:** Network hiccups should not disrupt mental matches. High-performance calculations (evaluation, move validation, move generation) happen client-side immediately, and profiles and ratings sync seamlessly with the cloud when connection is available.

---

## 3. User Personas & Target Audience
*   **The Casual Learner:** Needs immediate positional feedback, visual chess guides, tutorials with speech, and beginner-level AI (Tiers 0-1) that acts like a human beginner, blundering naturally instead of playing statistically flat sub-optimal moves.
*   **The Competitor:** Loves tracking stats (Win/Loss/Draw ratios per color, streak records, ranking tier) and playing online/local matchups to push their boundaries.
*   **The Enthusiast / Grandmaster Elite:** Demands professional-level analysis, high-tier engine evaluations (UCI Stockfish 10 WASM Integration), and customized chess piece styles.

---

## 4. Core Features & Functional Scope
### A. The Chess Board Representation (2D & 3D Dual Engine)
*   **3D Camera & Board:** Integrated `Three.js` + `@react-three/fiber` rendering. Orbit controls allow 360-degree rotation and vertical polar adjustments so users can view the game from any perspective.
*   **Piece Customizations:** High-quality 3D chess pieces mapping 5 custom visual subsets (Classic, Royal, Literature, Sports, Modern).
*   **Move Highlights & Feedback:** Instant legal move dot indicators, last move trail markers, check warnings, and custom dynamic coordinate indicators.

### B. The 27-Stage AI Progression System
*   **Beginner Tier (Levels 1 - 15):** Ranges from Cadet to Master Recruit. Uses Custom Hand-Crafted MiniMax AI. Position tables intentionally configured to allow natural blunders.
*   **Intermediate Tier (Levels 16 - 26):** Ranges from Baron to King. Positional strength increases. More depth-search is applied with positional caches.
*   **Grandmaster Tier (Level 27):** Uses state-of-the-art Stockfish 10 compiled to WebAssembly, running inside a background Web Worker to preserve 60 FPS gameplay.

### C. Learning & Academy Portal
*   **Interactive Playthroughs:** Dynamic chess problem exercises, key tactical layouts, and real-time narrated solutions using advanced Web Synthesis.

### D. Profiles, Premium & Leaderboards
*   **Detailed Analytics:** Multi-column statistical graphs checking White vs. Black performances, current streak, longest streak, and consecutive losses.
*   **Premium Membership:** Stripe checkout integration unlocking high-tier engine analysis, exclusive board textures, and unlimited daily Undos.
*   **Leaderboard:** Global ranking panel displaying top players.

---

## 5. Features Roadmap (FEATURES_ROADMAP)
### ✅ MVP Scope (Completed)
*   Fully functional 2D and 3D play modes with smooth material animations.
*   Custom Negamax AI engine supporting levels 1 to 26 and Stockfish WebWorker integration for Level 27.
*   Firebase multi-platform registration (Google OAuth / Guest setup).
*   Local stats aggregation and background audio playback with mute-controls.

### 🟡 Phase 2 Expansion (In Progress)
*   Refined audio management to resolve browser autoplay policy blockades.
*   Optimized web deployments on Cloud Run with proper security standard headers.
*   Local-first chess game persistence allowing matches to resume instantly if the tab runs out of memory or gets refreshed.

### 🔮 Future Expansion (Version 3.0)
*   Full Live Real-Time Multiplayer matchmaking utilizing Socket.io server-mesh.
*   AI analysis graph showing the "blunder profile" after completing matches.
*   Pristine AR (Augmented Reality) gameplay overlays for mobile deployments.
