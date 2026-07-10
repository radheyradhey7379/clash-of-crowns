# ONLINE & SECURITY AUDIT TODO

**Audit Status**: `ONLINE_SECURITY_AUDIT_PENDING`

This document lists the security, performance, and integrity audits to perform for the online multiplayer/backend systems before the official production launch.

---

## 1. Authentication & Session Security

- **Session Hijacking Prevention**:
  - Implement validation check of client IP and user agent in session verification flows.
  - Audit device ID generation stability on client side.
- **Concurrent Session Locks**:
  - Audit the `/session/current` Firestore endpoint to ensure concurrent active logins trigger immediate termination.
  - Implement a token revocation flow when a user forces session override.
- **WebSocket Reconnection Abuse**:
  - Rate-limit reconnect requests from client on socket disconnection.
  - Ensure disconnected socket states clean up the host/guest presence subcollections in `/multiplayerRooms/{roomId}/presence/` within 30 seconds.

---

## 2. Database Write Restrictions & Anti-Cheat

- **Firestore Rules Hardening**:
  - **User Document Self-Updates**: Limit the fields a user can update on `/users/{uid}`. Restrict user updates on `role`, `rating`, `wins`, `losses`, ` streak`, etc., using strict schema checks.
  - **Leaderboard Writes Validation**: Convert leaderboard writes from client-side (`allow write: if isOwner(userId)`) to fully server-side cloud functions to prevent score spoofing.
  - **Gameplay Sessions**: Restrict access to `/gameplaySessions/{sessionId}` to verified match participants only.
- **Temporary Match Data Cleanup**:
  - Setup a scheduled Cloud Function (Cron job) to clean up expired multiplayer rooms and abandoned gameplay sessions older than 24 hours.
- **Replay/Match History Retention**:
  - Set a hard retention policy for match history. Archive matches older than 30 days to low-cost cold storage.

---

## 3. Account Moderation & Ban Flow

- **Ban System Architecture**:
  - Add `accountStatus: 'active' | 'suspended' | 'banned'` field to user profiles.
  - Update `firestore.rules` and backend APIs to check that the requesting user's account is not banned.
  - Define banning criteria (e.g., cheating detection, chat harassment) and admin tools for suspension.

---

## 4. Payment Entitlement Protection

- **Double-Verification Auditing**:
  - Audit the backend `/api/billing/verify` endpoint. Ensure purchase token replay attacks (sending a previously used Google Play transaction ID) are blocked by verifying token uniqueness in a transaction.
  - Implement Server-to-Server RTDN (Real-Time Developer Notifications) from Google Play Console to instantly revoke features when a refund or chargeback occurs.

---

## 5. Client-Side Integrity & Performance

- **Rust Wasm Memory Security**:
  - Audit potential memory tampering vectors where local client memory is modified to affect match outcomes.
- **Local Cache/LRU Crash Recovery**:
  - Audit local storage quota usage. Implement automatic LRU (Least Recently Used) cleanup for chess analysis database cache when local storage limits are approached.
- **Feature Availability Fail-safes**:
  - Ensure automatic graceful fallbacks when network features (e.g., node health, firebase syncing) go offline during active gameplay.
