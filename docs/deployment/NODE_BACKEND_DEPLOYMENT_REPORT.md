# Node.js Backend HTTPS Deployment Report

This report documents the security configurations, endpoints, and deployment procedures for the Clash of Crowns Express backend.

## 1. Backend Security Responsibilities
The Node.js backend operates as the primary security gateway for Firestore writes and authentication:
- **Firebase Auth Verification**: Intercepts client requests and validates client-supplied Firebase ID tokens using the `firebase-admin` SDK.
- **Session Token Generation**: Issues short-lived, HMAC-SHA256-signed session tokens representing authenticated users.
- **Ranked Result Application**: Verifies the authenticity of game results submitted by the Rust backend using `RANKED_RESULT_HMAC_SECRET` before applying ELO changes.
- **Leaderboard Management**: Updates the read-only `arena_kings` leaderboard using Admin permissions.

## 2. API Endpoints
- **GET `/health`**: Returns `{"status":"ok"}`.
- **GET `/version`**: Returns current app version and gate settings.
- **POST `/api/auth/session-token`**: Verifies Firebase ID token, returns `{sessionToken, expiresAt}`.
- **POST `/api/ranked/verify-and-apply`**: Verifies signed match result, updates ELO and leaderboard.
- **POST `/api/tournaments/register`**: Registers a user for active tournaments.
- **POST `/api/tournaments/start`**: Begins bracket generation and tournament matches.
- **POST `/api/tournaments/report-result`**: Authoritative submission of tournament game outcomes.
- **POST `/api/narration`**: Receives translation & text and queries Gemini API (model `gemini-2.5-flash`), returning base64 narration audio.

## 3. Production Hardening
- **HTTPS**: Forced TLS on cloud gateway.
- **CORS Configuration**: Restricts origin requests strictly to verified client URLs (Capacitor schemas and allowed domain names).
- **Rate Limiting**: Configured `express-rate-limit` to prevent brute force/DOS attacks on authentication endpoints.
- **Logging Safe**: All console logs mask sensitive tokens and exclude PII.

## 4. Rollback and Recovery
If a deployment fails, the rollback command is:
- **Heroku**: `heroku rollbacks:create v<previous_version>`
- **Fly.io**: `fly deploy --image <previous_image_tag>`

## 5. Final Status
**MANUAL_PENDING**. Production servers require manual deployment and validation.
