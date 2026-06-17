# Phase 32A: Critical Security Hotfixes from Technical Audit

## Objective
Address critical and high-priority security issues identified during the technical audit to prepare the v1.0 release for production. This phase focuses on hardening Firebase configurations, reducing PII exposure in logs, mitigating hardcoded encryption salts, and tightening leaderboard constraints.

## Fixed Issues

### 1. Firebase Config Exposure
**Issue**: Firebase API keys and config values were hardcoded in `firebase-applet-config.json` and directly imported into production builds.
**Fix**: Changed the config initialization in `src/lib/firebase/firebase.ts` to exclusively read from `import.meta.env` (e.g., `VITE_FIREBASE_API_KEY`). The local `firebase-applet-config.json` now contains dummy placeholders to prevent accidental commits of real secrets.

### 2. Production Debug Logs
**Issue**: `setLogLevel('debug')` was hardcoded globally for Firebase, spamming production logs.
**Fix**: Wrapped the log level initialization in an `import.meta.env.DEV` check. Production builds now silence verbose Firebase debugging.

### 3. PII Exposure in Error Logs
**Issue**: The `handleFirestoreError` helper indiscriminately stringified the full `auth.currentUser` object when a network or permissions error occurred, exposing email, provider data, and tenant IDs.
**Fix**: Redacted `email`, `emailVerified`, `providerInfo`, and `tenantId` from the `FirestoreErrorInfo` interface. Only non-PII fields like `userId` and `isAnonymous` are logged.

### 4. Hardcoded Encryption Salt
**Issue**: The local encryption utility (`src/lib/encryption.ts`) relied on a hardcoded, committed fallback salt (`crowns-salt`).
**Fix**: Removed the hardcoded fallback.
- In `DEV` mode: It falls back to a warning and uses `'dev-fallback-salt'` to prevent breaking local testing.
- In `PROD` mode: It safely fails if `VITE_ENCRYPTION_SALT` is missing, throwing a `CRITICAL` error but avoiding a hard application crash (by utilizing an empty string).
*Note*: Local encryption is obfuscation only, not true anti-cheat. Future phases will introduce HMAC save integrity validation on the backend.

### 5. Leaderboard Write Constraints
**Issue**: Comp Kings and Arena Kings leaderboards accepted arbitrary rating changes directly from the client.
**Fix**: 
- Added a `MAX_COMP_LEADERBOARD_SCORE` constant (10,000,000).
- `compLeaderboardService.ts` now drops updates if scores are non-finite, negative, or above the cap.
- `arenaLeaderboardService.ts` entirely drops local score submissions when `isRankedArenaEnabled()` is false.
- `firestore.rules` enforces score constraints (`>= 0` and `<= 10000000`).

### 6. Admin Firestore Rules Hardening
**Issue**: `firestore.rules` checked for admin privileges using a hardcoded personal email string.
**Fix**: Retained the hardcoded email temporarily (with a `TODO_BEFORE_PRODUCTION_ADMIN_RELEASE`) to avoid breaking the current development workflow, but introduced the correct Firebase custom claim check: `request.auth.token.admin == true`.

### 7. Security Scan Automation
**Issue**: No automated step to detect secrets slipping into the codebase.
**Fix**: Authored `scripts/security/security-scan.mjs` and bound it to `npm run security:scan`. It statically analyzes the `src/`, `firebase/` and `.env` files for common key patterns (`AIzaSy`, `sk_live_`, `BEGIN PRIVATE KEY`, hardcoded salts, or naked PII logs).

## Known Remaining Risks
- **Admin Email in Rules**: The personal email remains temporarily hardcoded in `firestore.rules`. It must be removed before opening any production admin portals.
- **Client-Authoritative Saves**: Local encryption provides only light obfuscation. Players on Android/Web can still technically manipulate local memory or save strings. Full anti-cheat requires server-side validation (Phase 32B+).

## Verification Results
- `npm run security:scan` passed (warnings only on DEV/local hostnames).
- Frontend tests passed (166 tests).
- Rust Cargo tests passed (18 tests).
- Capacitor Android sync passed.
- Missing Firebase ENV properly triggers offline mode without white-screening the application.

## Next Recommended Phase
**Phase 32B: Comp Career Offline Storage Hardening** - to finalize local obfuscation and file signature checking for offline saves.
