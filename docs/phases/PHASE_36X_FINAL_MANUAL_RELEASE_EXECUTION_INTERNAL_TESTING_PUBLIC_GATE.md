# Phase 36X: Final Manual Release Execution + Internal Testing + Public Launch Gate

## Phase Overview
This phase marks the transition from pre-launch configuration to manual execution, testing, and rollout tracking for v1.0.

### Major Deliverables Tracked
- [x] **Final Verification Results**: Run and log automated sweep.
- [x] **Signed AAB Status**: Define metadata, keystore rules, and incrementing version warning.
- [x] **Release Device Test Results**: Establish strict device testing matrix (NO-GO if not tested on a real phone).
- [x] **Play Console Internal Testing Status**: Define rollout track tracker.
- [x] **Tester Feedback Summary**: Prepare feedback log for 5-20 internal testers.
- [x] **RC2 Hotfix Log**: Set up tracking for post-RC1 hotfixes.
- [x] **Public Release GO/NO-GO**: Structure gating decision document.
- [x] **Post-Launch Monitoring Prep**: Define post-launch vital monitoring checklist.

## Phase Status Summary

### 1. Automated Checks
- **Status**: `COMPLETED`
- **Details**: Security scan, linting, production build, vitest tests, cargo check/tests, and capacitor sync completed successfully.

### 2. Signed AAB Generation
- **Status**: `MANUAL_PENDING`
- **Details**: Generation of the signed release `.aab` file must be executed manually in Android Studio by the developer.

### 3. Release Device Testing
- **Status**: `MANUAL_PENDING`
- **Details**: Installation and execution of tests on a real physical Android phone is mandatory. Public launch remains blocked (`NO-GO`) until this is performed.

### 4. Play Console Internal Testing
- **Status**: `MANUAL_PENDING`
- **Details**: Uploading signed AAB, configuring store listings, completing questionnaires (IARC/Data Safety), and inviting testers is a manual developer task.

### 5. Tester Feedback Collection
- **Status**: `MANUAL_PENDING`
- **Details**: Gathering and triaging feedback from 5-20 invited testers covering various Android OS versions.

### 6. RC2 Hotfix Needed
- **Status**: `YES`
- **Details**: Completed hotfix for Academy narration audio playback and text-to-speech fallback, resolving environment variable checks, response candidate parsing, and Webview user-gesture audio restrictions.

### 7. Public Release Decision
- **Status**: `GO_INTERNAL_TESTING` (Public Release is `MANUAL_PENDING` / `NO-GO` until real-device testing and feedback are complete).

## Next Actions for User
1. Open Android Studio, generate the signed release AAB, and save it to the release path.
2. Install the release build on a physical Android phone and run through the checklist in `docs/testing/PHASE_36X_RELEASE_DEVICE_TEST_RESULTS.md`.
3. Upload the AAB to the Play Console Internal Testing track, complete compliance forms, and invite 5-20 testers.
4. Distribute the tester opt-in link and collect feedback.
