# Firebase & Google Login Configuration Guide

This document covers the resolution steps for Google Sign-In availability on the web deployment and mobile Capacitor applications.

## 1. Web Deployment (Render)

Google Sign-In uses OAuth 2.0 flow, which requires the hosting domain to be whitelisted under the Firebase Auth Project settings. If not whitelisted, sign-in attempts will be blocked by Firebase.

### Required Actions (Firebase Console):
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **gen-lang-client-0755336720**.
3. Navigate to **Build** -> **Authentication** -> **Settings** tab.
4. Click on **Authorized Domains** in the left menu.
5. Add the following production domains to the list:
   - `clash-of-crowns-node.onrender.com`
   - `clash-of-crowns-rust.onrender.com`
   - `localhost` (for local development testing)

---

## 2. Android Capacitor App (Mobile)

On Android devices running through Capacitor WebViews, `signInWithPopup` is blocked. Instead, native Google Sign-In must be used, which links directly to the Google Play Services layer.

### Required Actions (Firebase Console & Google Play Console):
1. **Retrieve SHA-1 Certificate Fingerprint**:
   Generate your release SHA-1 key from your release keystore using keytool:
   ```bash
   keytool -list -v -keystore android/app/release.keystore -alias your_alias
   ```
2. **Add SHA-1 to Firebase Project settings**:
   - Navigate to Project Settings (Gear icon) -> **General** in Firebase Console.
   - Under **Your apps** -> **Android app**, click **Add fingerprint**.
   - Paste the SHA-1 fingerprint and save.
3. **Configure Google Play Games Services**:
   - In Google Play Console, link your app's package name (`com.clashofcrowns.game`) to the Firebase project credentials.
   - Sync the OAuth client ID generated in Google Cloud Console.
