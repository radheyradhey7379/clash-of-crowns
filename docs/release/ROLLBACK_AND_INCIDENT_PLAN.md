# Incident Response & Rollback Plan (v1.0)

This document outlines emergency procedures if critical bugs are discovered in production after the v1.0 launch.

## 1. Triggering Maintenance Mode
If a devastating bug is found (e.g., Save corruption, Leaderboard exploits):
1. Open the Firebase Remote Config dashboard.
2. Set the `maintenance_mode` flag to `true`.
3. Set the `maintenance_message` string to inform users.
4. **Impact**: All users will immediately be blocked from the app until the issue is resolved and the flag is set to `false`.

## 2. Triggering a Forced Update
If a severe client-side bug is fixed in v1.0.1 and we need all users to update:
1. Publish v1.0.1 to the Play Store.
2. In Firebase Remote Config, update `min_required_version` to `"1.0.1"`.
3. **Impact**: Any user on `1.0.0` will see a blocking screen directing them to the Play Store.

## 3. Disabling Risky Features Remotely
If a specific feature is causing crashes, use Remote Config feature flags (if implemented for that feature) to softly disable it without requiring an app update or maintenance mode.

## 4. Reverting to a Previous Build
1. Locate the safe Git tag (e.g., `git checkout v1.0.0`).
2. Run a clean build (`npm run build`, `npx cap sync android`).
3. Increment the `versionCode` in `build.gradle` (e.g., `versionCode 2`).
4. Generate a new signed AAB and push to the Play Store.

## 5. Known Emergency Cases & Mitigations
- **Broken Save Loading**: If validation logic is crashing on startup, push an immediate client update with relaxed validation or fallback repair mechanisms.
- **Leaderboard Spam/Exploit**: Purge the `leaderboard` collection in Firestore. Increase `SuspiciousSaveDetector` severity thresholds.
- **Cloud Sync Failing**: Check Firebase quotas/billing. If the service is down, the app will gracefully fallback to local offline storage, mitigating disaster.
- **App Crash on Startup (White Screen)**: Usually caused by bundle/chunk loading failures. Ensure CDN/hosting is stable and verify Android WebView compatibility.

## 6. Pre-Hotfix Checklist
Before rushing an emergency hotfix out:
- Always run `npm run lint` and `npx vitest run`.
- Always verify the hotfix does not break backward compatibility with older local saves.
