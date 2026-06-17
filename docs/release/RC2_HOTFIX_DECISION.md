# RC2 Release and Hotfix Decision Log

This log evaluates whether feedback from the closed beta necessitates an RC2 (Release Candidate 2) build, or if we can proceed to public launch.

## 1. Gating Criteria for RC2 Build
An RC2 build and subsequent AAB increment are mandatory if any of the following occur during the Play Console internal test phase:
- **Crash Vitals**: Any crash, native crash, or ANR (App Not Responding) reported in Google Play Console Vitals.
- **Security Audit Failure**: Uncovered client-side authentication bypasses or database rules leaks.
- **Core Feature Defect**: Narrations failing to load on target versions or move validator failing to register legal moves.

## 2. Release Candidate Versioning Rules
If a hotfix is required:
1. Fix the issue in the local repository.
2. Increment `versionCode` in `android/app/build.gradle` by 1.
3. Append hotfix suffix to `versionName` or increment minor version (e.g. `1.0.0-rc2` or `1.0.1`).
4. Re-run complete local automated verification sweeps (`npm run lint`, `npx vitest run`, `security:scan`).
5. Re-generate signed release AAB.
6. Upload to Google Play Console as a new release track.

## 3. Decision Log
- **RC1 Target Build**: Clash of Crowns v1.0.0 (versionCode 1).
- **Current Findings**: 0 critical/high issues detected in automated test sweeps. Local build compiles successfully.
- **Recommendation**: Proceed to live internal testing with RC1. If testers encounter bugs matching Critical/High thresholds, trigger RC2.

## 4. Final Status
**MANUAL_PENDING**. Requires tester evaluations.
