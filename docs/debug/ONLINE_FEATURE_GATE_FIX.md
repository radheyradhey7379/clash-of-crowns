# Online Feature Gate Fix

This document covers the staged release gating structure for online match modes.

## 1. Feature Availability Gates
Updated `src/lib/config/featureAvailability.ts` to implement a multi-layered check for `multiplayer`:
- **Local environment check**: `isMultiplayerEnabled()` must be true.
- **Remote configuration check**: `multiplayerEnabled` must be true and `multiplayer` must not be present in `disabledFeatures`.
- **Maintenance check**: `maintenanceMode` must be false.
- **Backend health checks**: Both Node server (`/api/health`) and Rust server (`/health`) health checks must return `ok`.
- **Auth verification check**: The player must be logged in (`auth.currentUser !== null`).

## 2. Beta Staging Lockdown
- **Ranked Match** and **Championship Tournament** are locked for this staging release, returning `false` from `isFeatureAvailable`.
- The unavailable reason for Ranked Arena returns `"Coming Soon / Beta Locked"`.
- The unavailable reason for Tournament returns `"Coming Soon / Locked until tournament gates pass"`.
- These features are clearly marked in the UI and show their respective reasons when clicked.

## 3. Developer Gates Inspection
Exported a safe, developer-only console helper `window.inspectFeatureGates()` that outputs the resolved state of all feature gates and connection flags when the application is running in development mode.
