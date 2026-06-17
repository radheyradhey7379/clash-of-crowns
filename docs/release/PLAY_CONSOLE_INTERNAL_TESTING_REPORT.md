# Play Console Internal Testing Report

This report outlines the Google Play Console configurations and checklists required to publish the signed release build to the internal testing track.

## 1. Google Play Console Upload Steps
1. Log in to the Google Play Console developer dashboard.
2. Select **Clash of Crowns** application.
3. In the left-hand menu, navigate to **Release > Testing > Internal testing**.
4. Click **Create new release** in the top-right.
5. Upload the signed `app-release.aab` file.
6. Verify that the SDK target and application package metadata match the build report.
7. Enter release notes (e.g. "Clash of Crowns Version 1.0.0-rc2 Release").
8. Click **Save** and then **Review release**.

## 2. Store Readiness Checklist
Before rolling out the internal release, ensure the following store listing elements are complete:
- [ ] **Privacy Policy**: Add a valid privacy policy URL in App Content settings.
- [ ] **Data Safety**: Complete the Data Safety questionnaire (declaring Firebase database storage and account management details).
- [ ] **App Content & Rating**: Complete the IARC Content Rating questionnaire to receive a valid maturity rating.
- [ ] **Target Audience**: Select age target groups (e.g., 13+).
- [ ] **Store Listing Assets**:
  - High-res app icon (512x512 PNG).
  - Feature graphic (1024x500 PNG).
  - Minimum of 2 phone screenshots showing the chessboard UI.

## 3. Tester Distribution
- [ ] **Tester List**: Add tester emails (5 to 20 emails) to the internal testing track.
- [ ] **Opt-In Link**: Copy the tester opt-in link and share it with the QA group to let them install the app from Google Play.

## 4. Final Status
**MANUAL_PENDING**. Requires active access to the Google Play Console publisher profile.
