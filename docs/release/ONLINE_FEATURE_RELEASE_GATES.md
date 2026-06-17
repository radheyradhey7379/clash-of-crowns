# Online Feature Release Gates Report

This report outlines the release gating mechanism designed to prevent incomplete or unstable features from being exposed to the general public.

## 1. Staged Rollout Strategy
Clash of Crowns uses a staged release architecture to scale and test online components safely:
1. **Stage 1: Closed Beta (Friend Multiplayer)**
   - Gates: Local flags enabled, Remote Config restricts access to white-listed UIDs.
   - Purpose: Verify socket connections, latency, and mobile voice narration fallbacks.
2. **Stage 2: Open Beta (Ranked Arena)**
   - Gates: Enable `VITE_ENABLE_RANKED_ARENA`. Server authority active.
   - Purpose: Test matchmaking ELO adjustments, server signatures, and anti-cheat validations.
3. **Stage 3: Public Release (Tournaments & Leaderboards)**
   - Gates: Remove closed-beta restriction from remote config; enable all client flags.
   - Purpose: General public availability.

## 2. Gating Configurations (`featureAvailability.ts`)
Each online feature must satisfy a multi-layered check:
1. **Local Env Flag**: Features must be compiled with `VITE_ENABLE_MULTIPLAYER=true` etc.
2. **Remote Config Gate**: Remote version config must not list the feature in `disabledFeatures` and must set `multiplayerEnabled` to `true`.
3. **Backend Health Gate**: The client conducts a `/health` check on the Node backend. If it fails, all online components are deactivated automatically.
4. **Authentication Gate**: User must be authenticated (`auth.currentUser != null`).
5. **Authority Gates**: Server chess move authority and ranked ELO result authority must be verified.
6. **Closed Beta Gate**: The `closedBetaPassed` flag must default to `false` in production to isolate early testing.

## 3. Remote Config Payload Schema
Stored in Firestore at `/config/version_gate`:
```json
{
  "appVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "minimumSupportedVersion": "1.0.0",
  "maintenanceMode": false,
  "forceUpdate": false,
  "multiplayerEnabled": true,
  "rustRealtimeEnabled": true,
  "rankedArenaEnabled": true,
  "tournamentsEnabled": true,
  "disabledFeatures": []
}
```

## 4. Final Status
**COMPLETED**. The gating logic is fully integrated and tested in [featureAvailability.ts](file:///C:/Users/tripu/OneDrive/Desktop/clash-of-crowns/src/lib/config/featureAvailability.ts) and verified via Vitest.
