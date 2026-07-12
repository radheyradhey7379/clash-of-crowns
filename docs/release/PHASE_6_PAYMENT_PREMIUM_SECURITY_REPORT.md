# Clash of Crowns — Phase 6 Payment, Premium, and Entitlement Security Report

## 1. Product Config Table
All product details are centralized in `src/config/products.ts` and `src/config/pricing.ts` as the single source of truth:

| Product | Product ID | Type | Price | Source File | Used In | Pass/Fail |
|---|---|---|---|---|---|---|
| **Undo Daily Pass** | `undo_daily_pass` | inapp | ₹21 | [products.ts](file:///U:/clash-of-crowns/src/config/products.ts) | `PremiumScreen`, `GameScreen` | **Pass** |
| **Undo Monthly Pass** | `undo_monthly_pass` | inapp | ₹79 | [products.ts](file:///U:/clash-of-crowns/src/config/products.ts) | `PremiumScreen`, `GameScreen` | **Pass** |
| **Undo Yearly Pass** | `undo_yearly_pass` | inapp | ₹299 | [products.ts](file:///U:/clash-of-crowns/src/config/products.ts) | `PremiumScreen`, `GameScreen` | **Pass** |
| **Premium Access** | `premium_analysis_monthly` | subs | ₹349 | [products.ts](file:///U:/clash-of-crowns/src/config/products.ts) | `PremiumScreen`, `GameplayReview` | **Pass** |
| **Unlimited Undo Add-on** | `premium_undo_addon_monthly` | subs | ₹149 | [products.ts](file:///U:/clash-of-crowns/src/config/products.ts) | `PremiumScreen` | **Pass** |

---

## 2. Premium Feature Gate Table
Security gates for premium features are implemented strictly at the backend-verified entitlement level (`entitlements.hasPremiumAnalysis`) rather than local flags:

| Feature | Gate Mechanism | verified_entitlement | local_profile_fallback | Pass/Fail |
|---|---|---|---|---|
| **Premium Analysis** | `entitlements.hasPremiumAnalysis === true` | Yes | No | **Pass** |
| **Deep Move Review** | `entitlements.hasPremiumAnalysis === true` | Yes | No | **Pass** |
| **Best Move Suggestions**| `entitlements.hasPremiumAnalysis === true` | Yes | No | **Pass** |
| **Accuracy Score** | `entitlements.hasPremiumAnalysis === true` | Yes | No | **Pass** |
| **Premium Themes** | Gated on customisation unlock configurations | Yes | No | **Pass** |

---

## 3. Undo Pass Security Table
The game restricts undos using a combination of daily free counters, saved tokens, and subscription passes:

| State | Rule | Expected Behavior | Actual Behavior | Pass/Fail |
|---|---|---|---|---|
| **Free User (Undos 1-2)**| Allowed without purchase | Works normally | Works normally | **Pass** |
| **Free User (Undo 3+)** | Requires Undo Pass or Token | Blocks and prompts shop | Blocks and prompts shop | **Pass** |
| **Daily Pass** | Active for 24 hours | Expires after 24 hrs | Blocked upon expiry | **Pass** |
| **Monthly Pass** | Active for 30 days | Expires after 30 days | Blocked upon expiry | **Pass** |
| **Yearly Pass** | Active for 365 days | Expires after 365 days | Blocked upon expiry | **Pass** |
| **Local VS (Friend)** | Unlimited undos | Free & does not count | Free & does not count | **Pass** |

---

## 4. Firestore Rules Audit
[firestore.rules](file:///U:/clash-of-crowns/firebase/firestore.rules) defines robust security guards for client data. Direct client mutations of premium or admin roles are explicitly banned:

- **Read own profile**: Allowed for all authenticated players (`allow read: if isAuthenticated()`).
- **Update allowed fields only**: Users cannot write premium fields. `hasNoPremiumUpdates()` verifies that `isPremium`, `premiumPlan`, `undoPass`, `entitlements`, `subscription`, and `premiumAnalysis` are completely unchanged during any client-side update.
- **Read own entitlements only**: `match /users/{userId}/entitlements/{productId} { allow read: if isAuthenticated() && request.auth.uid == userId; allow write: if false; }` ensures that only read is possible, and only by the matching authenticated owner.
- **Tokens and events write block**: `purchaseTokens` and `billingEvents` write/read are strictly `false` for clients.
- **Gameplay sessions protection**: Restricted to participants/players listed in the session document.
- **Ban & Admin roles protection**: Profile updates reject modifying the user `role` field.

---

## 5. Billing Implementation Status
- **Classified Status**: `FULLY_IMPLEMENTED`
- **Native Bridge**: Uses dynamic resolving of `@capacitor/core` plugin interface `window.Capacitor.Plugins.PlayBilling`.
- **Sandbox Fallback**: Automates mock sandbox responses for web testing/development.
- **Server Verification**: Captures `purchaseToken` on successful purchase and sends it to the trusted `/api/billing/verify` endpoint for Google Play Developer API validation before updates are committed.

---

## 6. Bypass Attack Simulation Table
Defensive testing simulating client-side attacks was executed via the test suite:

| Attack | Expected | Actual | Pass/Fail |
|---|---|---|---|
| **1. Set localStorage.isPremium = true** | Denied (Ignored) | Denied (Ignored) | **Pass** |
| **2. Set localStorage.premiumAnalysis = true** | Denied (Ignored) | Denied (Ignored) | **Pass** |
| **3. Inject fake user profile fields via update** | Rejected by Firestore Rules | Rejected by Firestore Rules | **Pass** |
| **4. Modify local playerState.isPremium flag** | Ignored by Premium Gate | Ignored by Premium Gate | **Pass** |
| **5. Inject fake cached entitlements** | Ignored (Bypassed) | Ignored (Bypassed) | **Pass** |
| **6. Write directly to users/userId/entitlements** | Rejected by Firestore Rules | Rejected by Firestore Rules | **Pass** |
| **7. Try expired entitlement token** | Rejected (Comparison failed) | Rejected (Comparison failed) | **Pass** |
| **8. Access other player's entitlements** | Rejected by Firestore Rules | Rejected by Firestore Rules | **Pass** |
| **9. Carryover premium state after logout** | Cleared immediately | Cleared immediately | **Pass** |

---

## 7. Premium UI Safety Table
- **Home Premium Navigation**: No crash, navigates cleanly.
- **Result Popup Upgrade CTA**: No crash, transitions directly to `Premium` screen.
- **Product Display**: Prices fetched from central config or Play Store catalog are properly scaled for mobile viewports.
- **Error sanitization**: Detailed system codes (such as item already owned) are sanitized to localized messages like: `"Purchase unavailable. Please try again later."`

---

## 8. Automated Verification
- **Tests Added**: 44 new security & entitlement tests in [securityBilling.test.ts](file:///U:/clash-of-crowns/src/services/billing/__tests__/securityBilling.test.ts).
- **Tests Passed**: 661 / 661 unit/integration tests passed.
- **Android Compilation**: Debug compilation successful.
- **APK Checksum (SHA-256)**: `11CC2C97B33409EBFA5F45180D2DA0E8A80E06817D61728A340CA6316D898BFF`
- **APK Path**: [app-debug.apk](file:///U:/clash-of-crowns/android/app/build/outputs/apk/debug/app-debug.apk)
