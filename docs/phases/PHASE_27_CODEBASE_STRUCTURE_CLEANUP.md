# Phase 27 — Codebase Structure Cleanup & Developer Navigation

This phase focused on cleaning up the repository structure, organizing documentation files, moving source files into modular directories, creating path aliases, adding developer-friendly navigation READMEs, and verifying code integrity (builds, tests, formatting, Capacitor sync).

---

## 1. Codebase Folder Structure

### Before Cleanup
```text
clash-of-crowns/
├── android/
├── docs/
│   ├── README.md
│   ├── PRD.md
│   ├── TRD.md
│   ├── APP_FLOW.md
│   ├── BACKEND_SCHEMA.md
│   ├── UI_UX_BRIEF.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── AI_RULES.md
│   ├── PHASE_12B_...
│   └── (15+ other phase documents and reports mixed in root /docs)
├── firebase.json
├── firestore.rules
├── package.json
├── src/
│   ├── components/
│   │   ├── GameplayReview.tsx (mixed with general components)
│   │   └── ...
│   ├── lib/
│   │   ├── firebase.ts (mixed in root /lib)
│   │   ├── store.ts (mixed in root /lib)
│   │   ├── utils.ts (mixed in root /lib)
│   │   └── ...
│   └── services/
│       ├── stockfishService.ts (mixed in root /services)
│       └── ...
└── src-rust/
```

### After Cleanup
```text
clash-of-crowns/
├── android/
├── docs/
│   ├── README.md (organized index)
│   ├── android/
│   │   └── FULLSCREEN_MOBILE_PATCH.md
│   ├── architecture/
│   │   ├── AI_RULES.md
│   │   ├── APP_FLOW.md
│   │   ├── BACKEND_SCHEMA.md
│   │   ├── DATABASE_WEB_PROTOCOL.md
│   │   ├── IMPLEMENTATION_PLAN.md
│   │   ├── PRD.md
│   │   ├── TRD.md
│   │   └── UI_UX_BRIEF.md
│   ├── changelog/
│   │   └── (past release logs/changelogs)
│   ├── guides/
│   │   └── (guides & instruction manuals)
│   ├── phases/
│   │   ├── PHASE_12B_...
│   │   └── PHASE_27_CODEBASE_STRUCTURE_CLEANUP.md (this file)
│   └── reports/
│       └── (completion & security audit reports)
├── firebase/
│   └── firestore.rules
├── firebase.json
├── package.json
├── src/
│   ├── components/
│   │   ├── game/
│   │   │   └── GameplayReview.tsx
│   │   └── GameplayReview.tsx (named-preservation proxy)
│   ├── lib/
│   │   ├── firebase/
│   │   │   └── firebase.ts
│   │   ├── store/
│   │   │   └── store.ts
│   │   ├── utils/
│   │   │   └── utils.ts
│   │   ├── firebase.ts (named-preservation proxy)
│   │   ├── store.ts (named-preservation proxy)
│   │   └── utils.ts (named-preservation proxy)
│   └── services/
│       ├── stockfish/
│       │   └── stockfishService.ts
│       └── stockfishService.ts (named-preservation proxy)
└── src-rust/
```

---

## 2. Moved Files List

The following source files were relocated to structured directories to avoid cluttering parent directories:

1. `src/components/GameplayReview.tsx` $\rightarrow$ `src/components/game/GameplayReview.tsx`
2. `src/lib/firebase.ts` $\rightarrow$ `src/lib/firebase/firebase.ts`
3. `src/lib/store.ts` $\rightarrow$ `src/lib/store/store.ts`
4. `src/lib/utils.ts` $\rightarrow$ `src/lib/utils/utils.ts`
5. `src/services/stockfishService.ts` $\rightarrow$ `src/services/stockfish/stockfishService.ts`

Internal relative imports within these files and other consumer files were updated to point to the new absolute/relative directories.

---

## 3. Proxy Re-Export List

To preserve exact original export styles (both named and default) without breaking existing third-party or internal module imports, compatibility proxy files were created at the original paths:

| Proxy File Path | Export Style Preserved | Target Real Path |
| :--- | :--- | :--- |
| `src/components/GameplayReview.tsx` | Default Export | `src/components/game/GameplayReview.tsx` |
| `src/lib/firebase.ts` | Named Exports | `src/lib/firebase/firebase.ts` |
| `src/lib/store.ts` | Named Exports | `src/lib/store/store.ts` |
| `src/lib/utils.ts` | Named Exports | `src/lib/utils/utils.ts` |
| `src/services/stockfishService.ts` | Named Exports | `src/services/stockfish/stockfishService.ts` |

---

## 4. Firebase Rules Path Decision

**Decision**: Relocated `firestore.rules` to `firebase/firestore.rules`.
- **Reasoning**: We verified that `firebase.json` could be safely updated to point to `"rules": "firebase/firestore.rules"` under the `"firestore"` key. The deployment configuration successfully links to the subfolder, which keeps the root folder free of Firebase rules files and configuration clutter.

---

## 5. Alias Configuration Summary

Path aliases were registered to allow cleaner imports (e.g., using `@/components/` instead of `../../components/`) and to future-proof the codebase structure.

These aliases were added under:
1. `tsconfig.json` (`compilerOptions.paths`):
   - `@/*` $\rightarrow$ `src/*`
   - `@game/*` $\rightarrow$ `src/game/*`
   - `@components/*` $\rightarrow$ `src/components/*`
   - `@lib/*` $\rightarrow$ `src/lib/*`
   - `@services/*` $\rightarrow$ `src/services/*`
   - `@types/*` $\rightarrow$ `src/types/*`
2. `vite.config.ts` (`resolve.alias`)
3. `vitest.config.ts` (`resolve.alias` - defined strictly under `resolve.alias` as requested in Correction 3, not incorrectly inside the `test` block)

---

## 6. Developer README Files Added

Descriptive, developer-oriented documentation index READMEs were added across critical directories to improve onboarding and navigation:
1. `docs/README.md`: Organized docs index mapping paths to categories.
2. `src/game/multiplayer/README.md`: Overview of the multiplayer state logic, adapter, and WS/Firestore fallback mechanics.
3. `src/game/social/README.md`: Overview of notifications, challenge room auto-creation, and seen/expired validation.
4. `src/game/leaderboard/README.md`: Explains Competitive vs Arena ELO rules and offline queueing sync.
5. `src/game/security/README.md`: Covers anti-cheat checksum logic, save security, and game session validation.
6. `src/lib/cloud/README.md`: Details about Cloud Save conflict resolution and Firestore backup/restore.
7. `src/lib/offline/README.md`: Summarizes service workers, stockfish fallback caching, and sync queues.
8. `src/services/realtime/README.md`: Overview of client-side WebSocket wrapper.
9. `src-rust/README.md`: In-depth documentation of the Axum WebSocket backend, protocol frame contracts, and deployment commands.

---

## 7. Verification Results

### Frontend
- **Type Check & Lint (`npm run lint` / `tsc --noEmit`)**: Completed with **0 errors**.
- **Production Build (`npm run build`)**: Compiled successfully.
- **Vitest Unit Suites**: **138 tests passed successfully** across all modules:
  - `src/game/multiplayer`: 25 passed
  - `src/game/social`: 24 passed
  - `src/game/leaderboard`: 9 passed
  - `src/lib/cloud`: 10 passed
  - `src/lib/offline`: 12 passed
  - `src/game/security`: 20 passed
  - `src/game/ai/__tests__/progression.test.ts`: 38 passed

### Rust Backend
- **Code Formatting (`cargo fmt`)**: Checked and verified.
- **Compilation Check (`cargo check`)**: Succeeded in 1.70s.
- **Unit/Protocol Tests (`cargo test`)**: **9 tests passed successfully** (including protocol version mismatches, room life-cycles, turn-based sequence logic, and reconnects).

### Capacitor / Android
- **Sync Command (`npx cap sync android`)**: Successfully synchronized native assets, plugins, and configurations.

---

## 8. Known Limitations
- Path aliases are fully supported by TypeScript, Vite, and Vitest, but older node runtimes might require transpilation or ESM resolution scripts if run directly via Node.
- The `src-rust` tests run against mock endpoints. Real connection tests require running the Axum server locally on port 3001.

---

## 9. Next Recommended Phase

### Phase 28: Live Ranked Matchmaking & Arena Queues
- Create a matchmaking queue (in Rust WebSocket layer) to pair online players of similar ELO ratings.
- Expand client-side match UI with "Ranked Queue" overlays, search timers, and opponent pair-up notifications.
