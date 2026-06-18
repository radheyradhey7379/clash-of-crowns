# Google Login Troubleshooting: Authorized Domains & Environment Variables

This document provides debugging steps and configuration verification for Google Authentication in *Clash of Crowns*.

## 1. Firebase Build-Time Environment Variables

The frontend application requires the following environment variables to be present during compilation/build time:

```bash
VITE_FIREBASE_API_KEY=your_production_api_key
VITE_FIREBASE_AUTH_DOMAIN=clash-of-crowns-node.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=clash-of-crowns-node
VITE_FIREBASE_STORAGE_BUCKET=clash-of-crowns-node.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

If these are not present, Google login is automatically disabled in the build and falls back to **Guest Mode Only**.

---

## 2. Firebase Authorized Domains

If the environment variables are correctly compiled but users see `Google login needs Firebase Authorized Domain setup.`, you must authorize the origin domains in the Firebase Console:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **clash-of-crowns-node**.
3. Navigate to **Authentication** > **Settings** > **Authorized Domains**.
4. Ensure the list includes:
   * `localhost` (for local development and testing)
   * `clash-of-crowns-node.onrender.com` (backend domain hosting the Node server)
   * Any final hosting or frontend deployment domains.

---

## 3. Android App OAuth Configuration

When running the Android application locally or in production, Google Login requires SHA fingerprint verification to issue tokens:

### Package Name
Verify that the package name in `android/app/build.gradle` is:
```groovy
defaultConfig {
    applicationId "com.clashofcrowns.game"
}
```

### SHA-1 and SHA-256 Fingerprints
You must add your signing certificate fingerprints to the Firebase project settings:

1. To generate local debug signing certificate fingerprints, run:
   ```bash
   ./gradlew signingReport
   ```
2. Copy the **SHA-1** and **SHA-256** fingerprints for the `debug` and `release` keys.
3. Go to Firebase Console > **Project Settings** > **General** > **Your Apps** > **Android App**.
4. Click **Add fingerprint** and paste the SHA-1 and SHA-256 values.
5. Download the updated `google-services.json` and copy it to `android/app/google-services.json`.
