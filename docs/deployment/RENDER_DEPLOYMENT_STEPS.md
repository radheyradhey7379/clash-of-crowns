# Render Deployment Guide

This guide documents the procedures for deploying the Clash of Crowns backend services on Render using Docker containers.

## 1. Prerequisites
- A Render account (log in at [dashboard.render.com](https://dashboard.render.com/)).
- The project repository connected to your Render account (via GitHub or GitLab).
- Hardened security rules deployed to Firestore.

## 2. Blueprint Deployment (`render.yaml`)
We have defined a Render Blueprint in [render.yaml](file:///C:/Users/tripu/OneDrive/Desktop/clash-of-crowns/render.yaml) which automatically configures:
1. `clash-of-crowns-node`: Node.js Express server on port `3000` (HTTPS).
2. `clash-of-crowns-rust`: Rust Axum WebSocket server on port `3001` (WSS).

To deploy using the blueprint:
1. Log in to the Render Dashboard.
2. Click **New +** in the top right and select **Blueprint**.
3. Select the Clash of Crowns repository.
4. Render will parse `render.yaml` and prompt you for the required environment secrets.
5. Provide the secrets and click **Apply**.

## 3. Manual Deployment Setup (Alternative)
If you prefer configuring the services manually:

### Service A: Node.js Express API
1. Navigate to **New + > Web Service**.
2. Select repository, and set:
   - **Name**: `clash-of-crowns-node`
   - **Environment**: `Docker`
   - **DockerfilePath**: `Dockerfile.node`
3. Under **Advanced**, add the environment variables from [PRODUCTION_ENV_CHECKLIST.md](file:///C:/Users/tripu/OneDrive/Desktop/clash-of-crowns/docs/release/PRODUCTION_ENV_CHECKLIST.md).
4. Set **Health Check Path** to: `/health`.

### Service B: Rust Realtime WS
1. Navigate to **New + > Web Service**.
2. Select repository, and set:
   - **Name**: `clash-of-crowns-rust`
   - **Environment**: `Docker`
   - **DockerfilePath**: `Dockerfile.rust`
3. Under **Advanced**, add:
   - `PORT`: `3001`
   - `DEV_MODE`: `false`
   - `SESSION_TOKEN_SECRET`: (sync with Node)
   - `RANKED_RESULT_HMAC_SECRET`: (sync with Node)
4. Set **Health Check Path** to: `/health`.

## 4. Environment Variables Configuration Check
Ensure the following keys are populated in Render environment settings:
- `SESSION_TOKEN_SECRET`: Unique high-entropy session signature.
- `RANKED_RESULT_HMAC_SECRET`: Unique high-entropy ranked signing signature.
- `GEMINI_API_KEY`: Production narration key.
- `FIREBASE_SERVICE_ACCOUNT`: Secure firebase admin credential JSON.

## 5. Verification Commands
After deployment, confirm both services are operational by running curl checks:
```bash
# Verify Node health check
curl https://clash-of-crowns-node.onrender.com/health
# Returns: {"status":"ok"}

# Verify Node version gate
curl https://clash-of-crowns-node.onrender.com/version
# Returns: {"version":"1.0.0"}

# Verify Rust websocket health check
curl https://clash-of-crowns-rust.onrender.com/health
# Returns: {"status":"ok","service":"clash-realtime"}

# Verify Rust websocket version check
curl https://clash-of-crowns-rust.onrender.com/version
# Returns: {"service":"clash-realtime","version":"0.1.0","protocolVersion":"1.0.0"}
```

## 6. Final Status
**MANUAL_PENDING**. Requires Render console setup and repository binding.
