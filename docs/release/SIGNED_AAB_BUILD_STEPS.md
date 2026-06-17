# Signed AAB Build Steps

Generating the final signed Android App Bundle (AAB) is required before uploading to the Google Play Console for Internal Testing.

**Status**: [MANUAL_PENDING] - Must be performed by the release manager on a secure local machine.

## Build Steps (Android Studio)

1. Open Android Studio.
2. Open the `android/` project folder (`File > Open > select the android folder`).
3. Allow Gradle sync to complete.
4. From the top menu, select **Build > Generate Signed Bundle / APK...**
5. Select **Android App Bundle** and click Next.
6. **Keystore Configuration**:
   - If you have an existing release keystore, click **Choose existing...** and select it.
   - If this is the first time, click **Create new...** to generate a `.jks` or `.keystore` file.
   - Enter the secure Key Store password.
   - Use the designated Release Key Alias and enter its password.
7. Click Next.
8. Select the **release** build variant.
9. Click **Finish**. Android Studio will compile the Release AAB.
10. Once completed, a notification will appear. Click **locate** to find the generated `.aab` file (typically in `android/app/release/app-release.aab`).
11. Rename the file to `clash-of-crowns-v1.0.0-internal-testing.aab` for clarity.

## Critical Security Rules
- **DO NOT STORE OR COMMIT KEYSTORE:** Never commit the `.jks`/`.keystore` file, passwords, or `key.properties` with secrets to Git.
- **Offline Backup:** Store a backup copy of the release keystore securely offline (e.g., encrypted USB drive or secure company password manager vault). If you lose this key, you cannot update the app!
- **Play App Signing:** Ensure you opt-in to Google Play App Signing during the upload process in the Play Console.
- **Version Updates:** For any future patches (e.g., `1.0.1`), you MUST increment `versionCode` in `android/app/build.gradle` before generating a new AAB.
