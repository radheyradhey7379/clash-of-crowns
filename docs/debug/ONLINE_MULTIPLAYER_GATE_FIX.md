# Online Multiplayer Gating & Health Check Debug Guide

This document describes how feature gates, health checks, and guest sessions regulate availability for Casual/Friend Online Match, Ranked Match, and Championship Tournament.

## 1. Casual / Friend Online Match Gating Logic

Casual/Friend Online Multiplayer is active when:
- Local flags are set (`VITE_ENABLE_MULTIPLAYER=true` and `VITE_ENABLE_RUST_REALTIME=true`).
- Node server health check status is not `'failed'`.
- Rust server health check status is not `'failed'`.
- App is not in maintenance mode.
- Current app version is supported (greater than or equal to `minimumSupportedVersion` in version gate configuration).

### Temporary Guest Session
If Firebase is not configured or Google Login is unavailable, Guests can request a temporary session token. The Node server issues a token signed with `SESSION_TOKEN_SECRET` with the UID format `guest_<visitorId>` which is accepted by the Rust realtime backend for Casual/Friend matches.

Guests are completely blocked from participating in Ranked Matches, writing to ELO scores, or modifying leaderboards.

## 2. Health Gate Warmup & Timeout

Health checks can resolve to three states: `'healthy'`, `'failed'`, and `'unknown'` (the initial state during server warmup).

- **Warmup State (0 - 30 seconds):** While health status is `'unknown'`, the Casual/Friend match button is kept **active/enabled** to allow connecting while servers spin up on Render.
  - If the check has been `'unknown'` for more than 10 seconds, the UI subtitle displays `"Waking server..."`.
- **Timeout State (> 30 seconds):** If the status remains `'unknown'` for 30 seconds, it transitions to `'failed'`. The button becomes **disabled** (inactive), and the subtitle displays `"Backend unavailable"`.

## 3. Dev Gate Inspector

In development builds, you can inspect the exact state of all gates by opening the browser developer console and running:
```javascript
window.inspectFeatureGates();
```
This logs detailed statistics about flags, health check status, auth session, version checks, and the final feature gate decision.
