# Signed Android App Bundle (AAB) Generation Report

This report outlines the configurations and manual release procedures required to generate the production-ready Android App Bundle (AAB).

## 1. Release Configuration Audit
- **Application ID**: `com.clashofcrowns.game`
- **Minimum SDK version**: `22` (Android 5.1)
- **Target SDK version**: `36`
- **Build Target**: Release (`minifyEnabled true`, `shrinkResources true` enabled in `build.gradle` to compress APK size).

## 2. Version Tracking
- **versionCode**: Increment by 1 for each upload to the Play Console (e.g. from `1` to `2`).
- **versionName**: Semantic version matching (e.g. `1.0.0`).

## 3. Step-by-Step Signed Build Process in Android Studio
1. Open Android Studio on your workstation.
2. Select **File > Open** and choose the `android` folder in the project workspace.
3. Sync Gradle and wait for index compilation to complete.
4. Select **Build > Generate Signed Bundle / APK...** from the top menu.
5. Choose **Android App Bundle** and click **Next**.
6. Select your release keystore file (e.g., `clashofcrowns-release.keystore`).
7. Enter the keystore password, select your release key alias, and enter the key password.
8. Choose **release** build variant and click **Create**.
9. The signed AAB will be outputted to: `android/app/release/app-release.aab`.

> [!CAUTION]
> **Never commit your `.keystore` file, key passwords, or `key.properties` to version control.** These must reside strictly on the local developer build machine or in secure credentials vaults.

## 4. Build Output Checklist
- [ ] File size check: Check if `app-release.aab` is under 150MB (Play Store compressed limit).
- [ ] Decompile check: Verify that no debug assets or mock configs are packaged.

## 5. Final Status
**MANUAL_PENDING**. Requires compilation in Android Studio using production release certificates.
