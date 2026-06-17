# V1.0 Final Release Checklist

This checklist must be fully completed on Launch Day before pressing the "Publish" button.

## Pre-Flight Check
- `[ ]` **Environment Variables**: Verify `.env` disables all multiplayer, Rust, ranked, and tournament modes.
- `[ ]` **Tests Green**: `npx vitest run` and `cargo test` pass successfully.
- `[ ]` **Security Scan**: `npm run security:scan` reports no leaked secrets.
- `[ ]` **Version Info**: `versionCode` and `versionName` in `android/app/build.gradle` are correctly set for this release.
- `[ ]` **Firebase Production Config**: Double-check production Firebase rules and active Remote Config properties.

## Build Generation
- `[ ]` **Web Build**: `npm run build` succeeds cleanly.
- `[ ]` **Android Build**: `npx cap sync android` succeeds cleanly.
- `[ ]` **Signed AAB Generated**: Production keystore used to generate the `.aab` file from Android Studio. (Keep keystore safe, never commit it to Git).
- `[ ]` **Sideload Test**: Install the signed Release APK locally and run through the app launch and a single offline match.

## Play Store Console
- `[ ]` **App Title & Descriptions**: Finalized as per `PLAY_STORE_LISTING_V1.md`.
- `[ ]` **Screenshots & Graphics**: Uploaded.
- `[ ]` **Content Rating**: Complete and submitted.
- `[ ]` **Data Safety Form**: Completed matching `PRIVACY_DATA_SAFETY_NOTES.md`.
- `[ ]` **Privacy Policy Link**: Validated active and accessible.
- `[ ]` **Release Notes**: Added to the release track on Google Play.

## Rollback & Support
- `[ ]` **Rollback Plan Reviewed**: Team understands emergency procedures from `ROLLBACK_AND_INCIDENT_PLAN.md`.
- `[ ]` **Support Inbox**: Verified `support@clashofcrowns.com` is active and receiving emails.
