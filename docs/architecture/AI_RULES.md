# AI Coding Agent Guidelines & Rules - Clash of Crowns

## 1. Safety & Architecture Rules (AI_RULES)
To preserve the robust stability of the Clash of Crowns codebase across multiple agent sessions, any AI agent working on this repository **MUST** adhere strictly to these principles:

### A. Environment Bound Rules & Port Guidelines
*   **The Port is Hardcoded:** The application's server **MUST** run solely on Port `3000` and host `0.0.0.0` (it is mapped externally via Cloud Run containers). Never attempt to override port variables or modify port initialization logic in `server.ts`.
*   **Never Expose Raw Secrets:** Any sensitive integrations (such as Stripe Secret Keys or Gemini API Keys) **must** reside purely inside server-side environments. Prefix variables with `VITE_` **ONLY** if they are intended to be public client config variables (e.g., public URLs). Keep sensitive keys strictly server-side.

### B. Firestore Sandbox Resilience
*   Inside the Google AI Studio iframe environment, IndexedDB can become corrupted or blocked by browser storage rules, leading to immediate crashes like `Unexpected state (ID: ca9 / b815)`.
*   **Initialization Constraint:** Any client-side Firestore instance **must** be initialized via `initializeFirestore` using a `memoryLocalCache()` and `experimentalForceLongPolling: true` as shown below. Do not use default `getFirestore`.
```typescript
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
```

### C. Server-Side Bundling Configuration
*   If changing `server.ts`, verify that `package.json` contains the custom esbuild command:
```json
"build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs"
```
*   This compiles the backend code into a single, optimized CJS bundle (`server.cjs`), bypassing ESM path issues at container startup. Always verify that start commands point to `node dist/server.cjs`.

---

## 2. Active Session Log & Handover (AGENT_LOGS)
*   **Last Status update:** June 8, 2026.
*   **Action taken:**
    *   Applied the `experimentalForceLongPolling` and `memoryLocalCache` rules to the Firestore client module, resulting in 100% stability in the AI Studio preview window.
    *   Optimized `BGMPlayer.tsx` to handle browser autoplay policies. The player now hooks keyboard, click, and touch gestures, unlocking spatial background audio as soon as a user touches the screen, and cleanly unbinding listeners to avoid leaks.
    *   Added proper `frameAncestors` in CSP middleware config inside `server.ts` to clear canvas embedding blocks in Google properties.
    *   Generated complete architectural documents inside the `/docs` folder (`PRD.md`, `TRD.md`, `APP_FLOW.md`, `UI_UX_BRIEF.md`, `BACKEND_SCHEMA.md`, `IMPLEMENTATION_PLAN.md`, `AI_RULES.md`).

---

## 3. Recommended Handover Instructions for Next Agent
1.  **Read First:** View `/docs/AI_RULES.md` and `/docs/PRD.md` to instantly synchronize with the product flow.
2.  **Lint Check:** Always execute `npm run lint` or call `lint_applet` before updating files to verify full TypeScript compile safety.
3.  **Local-First Design:** Respect the local-first architecture. Do not add heavy, synchronous blocking network requests during ChessBoard matches.
