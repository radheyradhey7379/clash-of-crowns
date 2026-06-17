# Post-Launch Monitoring Checklist (Phase 36X)

This checklist outlines the procedures for monitoring, emergency hotfixes, and rollback handling immediately following the v1.0 public launch.

## 1. Daily Monitoring Activities
- [ ] **Play Console Dashboard**: Review daily active devices, install/uninstall rates, and update rates.
- [ ] **Play Console Android Vitals**: Monitor crash rates, ANR (App Not Responding) rates, and stack traces. Ensure crash rate remains below the Google Play threshold (< 1.09%).
- [ ] **User Reviews & Ratings**: Monitor new reviews for reports of game freezes, career progression losses, or offline mode failures.
- [ ] **Firestore/Firebase Logs**: Check Firestore security rule denials and read/write logs if traffic increases.
- [ ] **Leaderboard Logs**: Review Competitive and Arena Leaderboards for anomaly scores or suspicious rating jumps.

## 2. Emergency Response Procedures

### Scenario A: Critical Launch Crash (> 1% of users)
1. **Activate Maintenance Mode**: Toggle the remote force-update/maintenance flag in Firestore to prevent further user impact.
2. **Isolate Fix**: Check Play Console Android Vitals stack traces. Repoint local emulator to the issue, patch the bug.
3. **Internal Verification**: Rerun automated verification suite, generate signed AAB.
4. **Increment versionCode**: Increment `versionCode` by 1.
5. **Rollout Release**: Push the hotfixed build to Internal/Closed tracks first, then promote to Production.

### Scenario B: Save Data Corruption or Leaderboard Exploit
1. **Audit Security Event Logs**: Identify the save file version or payload causing validation failures.
2. **Deploy Hotfix**: Update client-side validation logic or Firestore rules to reject anomalous payloads.
3. **Wipe Malicious Entries**: Safely delete verified exploit rows from Firestore leaderboards.

## 3. Rollback Procedure
If a major regression is discovered that cannot be hotfixed within 4-6 hours:
1. Navigate to **Play Console > Release Overview**.
2. If using staged rollouts, halt the current release rollout immediately.
3. Push the previous stable build with an incremented `versionCode` to force-downgrade users safely to the last known stable state.
