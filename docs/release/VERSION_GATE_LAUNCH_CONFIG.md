# Remote Version Gate Config (v1.0 Launch)

The remote Version Gate object must be securely updated in Firestore at the path: `appConfig/versionGate/current`. 
This config explicitly controls features and updates securely from the backend without requiring a new client build.

## Launch-Safe Firestore Config

```json
{
  "latestVersion": "1.0.0",
  "minimumSupportedVersion": "1.0.0",
  "forceUpdate": false,
  "updateType": "optional",
  "maintenanceMode": false,
  "message": "Welcome to Clash of Crowns v1.0.",
  "playStoreUrl": "https://play.google.com/store/apps/details?id=com.clashofcrowns.game",
  "disabledFeatures": [
    "multiplayer", 
    "ranked_arena", 
    "challenge_match", 
    "tournaments", 
    "rust_realtime"
  ],
  "multiplayerEnabled": false,
  "rustRealtimeEnabled": false,
  "rankedArenaEnabled": false,
  "challengeMatchEnabled": false,
  "tournamentsEnabled": false,
  "updatedAt": "CURRENT_TIMESTAMP"
}
```

## Security Rules
- **No secrets**: This config document is readable by any client, so it must not contain API keys.
- **Read**: Allowed (`allow read: if true;`)
- **Write**: Admin-only (Restricted by Firebase Security Rules).
- **Hard Fallback**: Remote config must *not* be able to enable locally disabled features (features forced `false` in `.env`).

## Manual QA Test Cases
1. **Normal State**: Launch the app with config above. App boots directly to the title screen.
2. **Force Update Blocks App**: Set `minimumSupportedVersion` to `"1.0.1"`. Verify the app is blocked and displays the Play Store link. (Restore to `"1.0.0"` after test).
3. **Maintenance Mode Blocks App**: Set `maintenanceMode` to `true`. Verify the app halts at the boot screen with a maintenance message. (Restore to `false` after test).
4. **Soft Update Allows App**: Set `latestVersion` to `"1.0.1"`. Verify a dismissible alert appears recommending an update.
5. **Network Blocked**: Boot app in Airplane mode. Verify it loads into the cached state (`fallback_allowed`) securely within 2000ms.
