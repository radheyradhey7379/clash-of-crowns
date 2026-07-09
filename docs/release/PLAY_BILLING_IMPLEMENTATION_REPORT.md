# Google Play Billing Implementation Report (v9.1.0)
**Project**: Clash of Crowns Android Game  
**Date**: 2026-07-08  
**Package**: com.clashofcrowns.game  

---

## 1. Product Settings
The following Google Play Console product mappings have been verified and integrated into the app configuration ([products.ts](file:///U:/clash-of-crowns/src/config/products.ts)):

| Product ID | Type | Fallback price | Description |
|---|---|---|---|
| `undo_daily_pass` | Managed Product | ₹21 | 24 Hours Unlimited Undo |
| `undo_monthly_pass` | Managed Product | ₹79 | 30 Days Unlimited Undo |
| `undo_yearly_pass` | Managed Product | ₹299 | 365 Days Unlimited Undo |
| `premium_analysis_monthly` | Subscription | ₹149/month | Premium AI Analysis & Insights |

---

## 2. Security Constraints & Architecture
* **No Secrets Committed**: All API keys, Google credentials, keystores, and Firebase private keys are successfully registered in `.gitignore` and have been excluded from the repository.
* **Double Claim Protection**: All verified purchase tokens are SHA-256 hashed and stored inside a `/purchaseTokens` collection in Firestore. Re-using the same token on a different account will return a `409 Conflict`.
* **Firestore Security Rules**: Handled inside `firestore.rules`:
  - Users can read their own entitlements.
  - Clients cannot write or delete entitlements (write access restricted to Firestore Admin SDK on Render).
  - All read/write access to the `/purchaseTokens` index is blocked for clients.
* **Fallback offline/dev mode**: If the base64 Google service account environment variable is missing, the endpoint returns a clean message or defaults to a sandbox mock validation in non-production.

---

## 3. Native Capacitor Bridge
* Implemented `PlayBillingPlugin.java` exposing `loadProducts`, `purchaseProduct`, and `restoreActivePurchases`.
* Fully compatible with Google Play Billing Library version `9.1.0`.
* Correctly registers and binds the native callbacks and listens to lifecycle transitions.

---

## 4. Final signed AAB Details
* **Build Command**:
  ```bash
  npm run build
  npx vitest run
  npx cap sync android
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  ./gradlew clean
  ./gradlew bundleRelease
  ```
* **AAB Path**: `U:\clash-of-crowns\android\app\build\outputs\bundle\release\app-release.aab`
* **Package ID**: `com.clashofcrowns.game`
* **Version Name**: `1.0`
* **Version Code**: `1`
* **AAB Size**: `19,428,125 bytes` (approx 18.5 MB)
* **SHA-256 Hash**: `86ABBE05E756AC7AEF48BFDF1B6E120D6B90D406E31D66B23D273D925F11B488`

---
**Status: GOOGLE_PLAY_BILLING_READY_FOR_INTERNAL_TESTING_RELEASE**
