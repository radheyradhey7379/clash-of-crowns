# V1 Release Build Device Testing

Before approving the release for Internal Testing on Play Console, the signed release APK/AAB must be tested on a physical Android device to verify environment configuration, code obfuscation, and native integration.

### Prerequisites (MANUAL_PENDING)
- [ ] Generate signed APK or AAB for `release` build variant.
- [ ] Connect a physical Android device (API 26+) with USB Debugging enabled.

### Testing Checklist (MANUAL_PENDING)

**1. Installation & Boot (MANUAL_PENDING)**
- [ ] App installs without signature conflicts.
- [ ] App launches without crashing.
- [ ] Splash screen displays correctly.

**2. Offline Initialization (MANUAL_PENDING)**
- [ ] Turn off Wi-Fi and Cellular Data.
- [ ] Launch the app.
- [ ] App successfully reaches the Main Menu using the cached offline package.

**3. Account & Sync (MANUAL_PENDING)**
- [ ] Guest Login succeeds.
- [ ] Local-first saves apply correctly.
- [ ] (If applicable) Google Sign-In or Firebase Auth completes successfully without dev-environment warnings.

**4. Gameplay & Engine (MANUAL_PENDING)**
- [ ] Start a match against the AI (Versus Computer).
- [ ] Stockfish engine initializes and responds to moves.
- [ ] No UI freezing or frame drops during move calculations.

**5. Navigation & UI (MANUAL_PENDING)**
- [ ] Navigate to Academy, Customise, Profile, and Settings.
- [ ] All UI elements render correctly on the device's screen size.
- [ ] Safe area insets (notches) are respected.
- [ ] Native hardware back button behaves correctly (shows exit prompt or navigates back).

### Verification Result (MANUAL_PENDING)
*Pending physical device test execution.*
