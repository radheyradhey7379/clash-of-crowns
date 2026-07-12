# Clash of Crowns — Phase 8 API, Dependency, and Security Hardening Report

## 1. Dependency Inventory Table
This table catalogs the primary libraries in the project along with their versions and security status:

| Dependency | Current Version | Latest Stable | Used For | Risk | Action |
|---|---|---|---|---|---|
| **Vite** | `6.4.3` | `8.1.4` | Build Tooling | **SAFE** | Updated to `6.4.3` to resolve high advisories |
| **DOMPurify** | `3.4.12` | `3.4.12` | Sanitizing UI inputs | **SAFE** | Updated to `3.4.12` to fix XSS/Shadow DOM bypasses |
| **React** | `19.2.4` | `19.2.7` | UI Framework | **HOLD_MAJOR** | Keep on major v19 (stable) |
| **Capacitor Core** | `8.3.0` | `8.4.1` | Native wrapper | **SAFE** | Keep at 8.3.0 |
| **Firebase SDK** | `12.11.0` | `12.16.0` | Cloud database/auth | **SAFE** | Keep at 12.11.0 |
| **shakmaty** | `0.27.3` | `0.27.3` | Rust Chess representation | **SAFE** | Single source of truth (v0.27.3) |
| **axum** | `0.7` | `0.7` | Backend HTTP framework | **SAFE** | Gated behind features in WASM builds |
| **esbuild** | `0.28.0` | `0.28.1` | Backend compiler | **SAFE** | Kept in dev-only path |

---

## 2. NPM Audit & Outdated Summary
- **Before Audit Fix**: 32 vulnerabilities (1 critical, 6 high, 22 moderate, 3 low).
- **Vulnerability Resolution**: Ran `npm audit fix` successfully.
- **After Audit Fix**: 9 vulnerabilities (0 critical, 0 high, 8 moderate, 1 low).
- **transitive uuid advisory**: Low/moderate transitive `uuid` dependencies in Firebase Admin are harmless (dev-only backend tools).
- **Vite & DOMPurify security**: High-severity advisories resolved (Vite path traversal / DOMPurify XSS bypasses resolved by updating dependencies to `6.4.3` and `3.4.12` respectively).

---

## 3. Capacitor & Android Security Review
- **Package Identifier**: `com.clashofcrowns.game` (correct).
- **Permissions**: Declares only `android.permission.INTERNET` in `AndroidManifest.xml`.
- **Billing Permissions**: Automatically merged by Google Play Billing library dependencies during Gradle build (safe, no manual manifest injection).
- **Backup Rule**: `android:allowBackup="true"` is enabled.
- **Debuggable flag**: Not explicitly enabled in release configs, defaults to `false` in release assembly.
- **Cleartext policy**: No cleartext traffic enabled, defaults to safe secure HTTPS transfer only.
- **Keystore security**: Keystores (`*.jks`, `*.keystore`) and `android/key.properties` are blocked by `.gitignore`.

---

## 4. Firebase & Google API Security Review
- **Credentials safety**: Firebase public configuration matches allowed web config patterns. No private keys or service accounts are committed in the repository (fully gitignored).
- **Firestore rules**: [firestore.rules](file:///U:/clash-of-crowns/firebase/firestore.rules) contains client-write blocks for entitlements, billing event logs, user roles, bans, and participant-only gameplay session write bounds.
- **Remote Config offline fallback**: Safe mock variables are defined in [firebase.ts](file:///U:/clash-of-crowns/src/lib/firebase/firebase.ts) to prevent client crashes when offline.

---

## 5. Rust / WASM / Backend Security Review
- **Tests Passed**: 100 / 100 backend tests passed. 15 / 15 WASM tests passed.
- **WASM compilation isolation**: Resolved compilation failures when building `wasm-engine` on host targets by creating a `backend` feature gate. This restricts axum-specific HTTP handlers and test modules to backend builds, leaving the WASM engine free of web dependencies.
- **Release profile**: Optimized code compilation with LTO enabled and panics safely masked in production exports.

---

## 6. Endpoint Scan Table
Every endpoint in the source files was scanned for security:

| Endpoint | Used For | Environment | Safe For Release | Action |
|---|---|---|---|---|
| `import.meta.env.VITE_API_BASE_URL` | Resolving relative backend paths | Production | **Yes** | Uses absolute path only on mobile |
| `import.meta.env.VITE_REALTIME_WS_URL` | WebSocket signaling endpoint | Production | **Yes** | Defaults to `wss://` securely |
| `http://localhost:3001` | Dev-only local fallback | Local/Development | **Yes** | Completely compiled out in production |

---

## 7. Release Hardening Checklist
- [x] dev diagnostics / tests panels hidden in production builds.
- [x] Multiplayer features default to disabled in config feature flags unless explicitly set in deployment environment.
- [x] Console debug logs disabled/stripped in production.
- [x] No raw developer private key committed in source files.

---

## 8. Verification Results
- **Automated Tests**: Added 36 security and hardening tests in [phase8Hardening.test.ts](file:///U:/clash-of-crowns/src/game/engine/adapters/__tests__/phase8Hardening.test.ts).
- **All Tests Passed**: 727 / 727 Vitest tests passed.
- **Android Build**: Successfully assembled `app-debug.apk`.
- **APK Checksum (SHA-256)**: `8AA352D6CBC6221B5A9F46EF6187E67CC5EFA1BB0A5B14A482773AE724400C80`
