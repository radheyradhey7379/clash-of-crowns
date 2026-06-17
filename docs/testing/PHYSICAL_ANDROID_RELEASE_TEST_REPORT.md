# Physical Android Release Test Report

This report documents the verification checks required to validate the signed production release build (`app-release.aab` / `app-release.apk`) on a physical Android device.

## 1. Test Device Specifications
- **Device Model**: e.g., Google Pixel 7 / Samsung Galaxy S23
- **OS Version**: Android 14 / 15
- **Network Modes**: Wi-Fi, 4G/5G, and Offline mode.

## 2. Release-Blocking QA Verification Matrix

### Core Application Performance
- [ ] **Startup Verification**: App launches under 3 seconds. No white screen or infinite splash loader.
- [ ] **Authentication**: Login via Google and email auth functions correctly.
- [ ] **Offline Play**: Single-player Career mode launches immediately when cellular/Wi-Fi is turned off.
- [ ] **Stockfish Engine**: Local Stockfish engine works, calculates moves, and updates difficulty levels.
- [ ] **Board UI**:
  - 2D chessboard behaves correctly.
  - 3D chessboard loads assets asynchronously without memory exhaustion or crashes.
- [ ] **Cloud Saves**: Career progress saves and restores correctly from Firebase Cloud Saves.

### Narration and Audio UX
- [ ] **Academy Narration**: Narration translations in English, Hindi, and Arabic speak clearly. Falls back to SpeechSynthesis gracefully if backend GenAI key is missing or offline.

### Release Gate Integrity
- [ ] **Feature Lock**: If the backend server health check fails or remote config disables multiplayer, verify that matchmaking buttons change to "Temporarily Unavailable" or "Coming Soon" without crashing the application.
- [ ] **Version Gate**: Verify that setting `minimumSupportedVersion` above `1.0.0` in remote config correctly blocks access and displays the update prompt.

### Stability & Resource Audits
- [ ] **Stability Run**: Run continuous games for 15 minutes. Verify 0 application crashes.
- [ ] **Resource/Heat Check**: Verify device temperature and battery drain remain within acceptable boundaries.

## 3. Final Status
**MANUAL_PENDING**. Requires sideloading the release build onto a physical test handset.
