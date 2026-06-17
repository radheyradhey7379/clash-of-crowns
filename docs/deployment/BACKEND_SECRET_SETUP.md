# Backend Production Secrets Setup Guide

This guide outlines how to securely generate and configure secrets on the Clash of Crowns production backends (Node.js and Rust).

## 1. Environment Variable Specifications
| Variable | Owner | Target | Minimum Strength |
| :--- | :--- | :--- | :--- |
| `SESSION_TOKEN_SECRET` | Node & Rust | Auth session token signature | 32+ character high-entropy random string |
| `RANKED_RESULT_HMAC_SECRET` | Node & Rust | Match outcome integrity signature | 32+ character high-entropy random string |
| `GEMINI_API_KEY` | Node (Express) | Academy voice narration and translations | Google GenAI API Key (restricted to Gemini 2.5 Flash) |
| `FIREBASE_SERVICE_ACCOUNT` | Node (Express) | Firebase Admin SDK credentials | Full JSON service account config |

## 2. Generating Safe Secrets
Use `openssl` to generate high-entropy strings for production:
```bash
# Generate Session token secret
openssl rand -hex 32

# Generate Ranked result HMAC secret
openssl rand -hex 32
```
> [!IMPORTANT]
> **Never reuse the same key for both variables.** They must be unique to isolate session compromise from ranked result falsification.

## 3. Deployment Setup Methods

### Node.js (Express) hosting:
Configure these keys directly in the hosting provider's dashboard (e.g. Heroku, Render, AWS Elastic Beanstalk, or Fly.io env configurations).
Alternatively, write a secure `.env` file on the production container (ensure it is never committed).
Example `.env` template:
```env
PORT=3000
SESSION_TOKEN_SECRET=5f18c6ea4d7b21...
RANKED_RESULT_HMAC_SECRET=c2901a5d4e1b...
GEMINI_API_KEY=AIzaSy...
# Firebase Admin Credentials JSON as a single line string
FIREBASE_SERVICE_ACCOUNT_JSON='{"type": "service_account", "project_id": ...}'
```

### Rust (Axum) hosting:
Set the environment variables directly on the server hosting the Rust websocket daemon:
```env
PORT=3001
DEV_MODE=false
SESSION_TOKEN_SECRET=5f18c6ea4d7b21...
RANKED_RESULT_HMAC_SECRET=c2901a5d4e1b...
```

## 4. Final Security Checklist
- [ ] No secrets are present in frontend source files or Vite configurations.
- [ ] No `.env` or keystore credentials have been committed.
- [ ] Logs on the production instances are configured to mask/exclude any reference to token signatures or raw payloads.

## 5. Final Status
**MANUAL_PENDING**. Requires hosting account access to inject secrets.
