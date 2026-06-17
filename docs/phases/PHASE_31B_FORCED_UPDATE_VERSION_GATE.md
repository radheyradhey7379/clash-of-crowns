# Phase 31B: Forced Update & Secure Version Gate

## Objective
Implement a secure, non-intrusive BGMI-style required update, maintenance mode, and remote feature-control gate. This protects against version fragmentation and ensures that when features like Multiplayer are reactivated in the future, players on incompatible versions are safely blocked from accessing broken APIs.

## Architecture & Flow

### 1. Version Gate Decision Priority
When the app launches, it fetches a remote configuration and makes a routing decision based on the following strict priority:
1. **Maintenance Mode**: If `maintenanceMode` is true, block the app and show `MaintenanceScreen`.
2. **Force Update**: If `forceUpdate` is true OR the `getCurrentAppVersion()` is lower than `minimumSupportedVersion`, block the app and show `ForceUpdateScreen`.
3. **Soft Update**: If `latestVersion` is greater than the current version (but the minimum is satisfied), allow access but render the dismissible `SoftUpdateNotice`.
4. **Allowed**: Normal startup.
5. **Fallback Allowed**: If the remote fetch fails or times out (2000ms limit), default to safe offline-allowed logic to ensure players can still play Offline Comp Career.

### 2. Feature Precedence Rule
A feature (e.g., `multiplayer`, `rust_realtime`) is considered enabled **ONLY IF**:
- `import.meta.env.VITE_ENABLE_MULTIPLAYER` is `true` (Local Env Flag) **AND**
- Remote config does NOT include `"multiplayer"` in the `disabledFeatures` array **AND**
- Remote config `multiplayerEnabled` is `true` **AND**
- The app is NOT in maintenance mode.

This guarantees that a feature cannot be accidentally toggled on by the remote config if the local build considers it unsafe or disabled.

### 3. Caching & Timeout Behavior
- **Timeout**: The Firestore fetch will time out after 2000ms to prevent infinite loading spinners on bad networks.
- **Cache**: A successful remote config is cached locally. If the remote fetch fails, the app uses the cached config.
  - *Safety constraint*: Cached configs are only used to enforce blocks (like maintenance or forced updates). If the cache says "allowed", it is merged with the default secure offline configuration to prevent a stale cache from accidentally enabling dangerous features offline.

### 4. Firestore Configuration
**Path**: `appConfig/versionGate/current`

**Schema**:
```json
{
  "latestVersion": "1.0.0",
  "minimumSupportedVersion": "1.0.0",
  "forceUpdate": false,
  "updateType": "optional",
  "maintenanceMode": false,
  "message": "Welcome to Clash of Crowns!",
  "playStoreUrl": "market://details?id=com.clashofcrowns.game",
  "disabledFeatures": ["multiplayer", "rust_realtime", "ranked_arena", "challenge_match", "tournaments"],
  "multiplayerEnabled": false,
  "rustRealtimeEnabled": false,
  "rankedArenaEnabled": false,
  "challengeMatchEnabled": false,
  "tournamentsEnabled": false,
  "updatedAt": 1718165000000
}
```
**Security**: This document contains NO SECRETS. It is purely for UI and feature gating. It should be written by Admins only, and is readable by authenticated users (or public).

## Manual Verification Results
- **Force update**: Blocks app rendering correctly, redirects to Play Store URL.
- **Maintenance**: Blocks app rendering, provides a retry button.
- **Soft update**: Top banner overlays correctly and is dismissible.
- **Network Block / Timeout**: Fallback triggered within 2000ms. Allows offline Comp Career and AI matches.
- **Multiplayer**: Still reports as "Coming Soon" correctly.
- **Tests**: All 155 frontend tests passed. `cargo test` passed.

## Next Phase Recommendation
We recommend moving to **Phase 32: Comp Career Security Hardening** to ensure offline save systems and AI progressions are locked down against memory editing or save file tampering.
