# Firebase & Google Login Live Integration Fix

This document outlines the configuration and troubleshooting steps for Firebase Authentication and Google Sign-In in the live production environment.

## 1. Firebase Authorized Domains Setup

To allow Google Sign-In to succeed from the web hosting client, the backend/frontend domain must be authorized in your Firebase Console.

### Steps:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Go to **Authentication** (under Build) -> **Settings** -> **Authorized domains**.
4. Click **Add domain**.
5. Enter the following domains:
   - `clash-of-crowns-node.onrender.com` (If the web client is served there or proxies there)
   - `clash-of-crowns-web.onrender.com` (Or any other frontend hosting URLs)
   - `localhost` (For local development testing)

## 2. Android Google Sign-In Fingerprint Configuration

For the Capacitor Android app, Google Sign-In requires registering the application SHA-1 and SHA-256 fingerprints in Firebase.

### Requirements:
- **Package Name:** `com.clashofcrowns.game`
- **Keystore Credentials:** The signing keystore fingerprints (both debug and production release keys) must be added.

### Steps to obtain SHA-1 / SHA-256:
Run the following Gradle command under the `android/` directory:
```bash
./gradlew signingReport
```
Locate the SHA-1 and SHA-256 hashes for the `debug` and `release` variants.

### Steps to register in Firebase:
1. Go to **Project Settings** in the Firebase Console.
2. Select your Android application under **Your apps**.
3. Under **SHA certificate fingerprints**, click **Add fingerprint**.
4. Enter the SHA-1 and SHA-256 hashes and save.
5. Download the updated `google-services.json` file and replace the existing one in `android/app/google-services.json`.
