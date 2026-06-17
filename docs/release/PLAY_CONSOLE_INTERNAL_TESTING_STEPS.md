# Play Console Internal Testing Rollout Steps (Phase 35X)

The following steps detail the procedure for rolling out the game to Internal Testing in the Google Play Console. All steps must be completed manually by an authorized developer.

### Prerequisites (MANUAL_PENDING)
- [ ] Signed App Bundle (AAB) generated from `release` build variant.
- [ ] Keystore and passwords available.
- [ ] Active Google Play Developer Console account.

### 1. App Creation & Initial Setup (MANUAL_PENDING)
- [ ] Create a new app in Play Console named "Clash of Crowns".
- [ ] Set default language and confirm app type (Game) and pricing (Free).

### 2. Store Presence (MANUAL_PENDING)
- [ ] **Privacy Policy**: Upload the privacy policy to your website and link it in the App Content section.
- [ ] **Main Store Listing**: Provide Short Description, Full Description, App Icon (512x512), Feature Graphic (1024x500).
- [ ] **Screenshots Upload**: Upload at least 3 screenshots showing core gameplay (Main Menu, Chessboard, Academy).

### 3. App Content & Declarations (MANUAL_PENDING)
- [ ] **Data Safety Form**: Complete the Data Safety questionnaire (declare Crashlytics/Analytics if added, and local-first saves).
- [ ] **Content Rating**: Fill out the IARC questionnaire to receive an official content rating.
- [ ] **Target Audience**: Declare target age group (e.g., 13+).
- [ ] **Ads Declaration**: Declare whether the app contains ads (No).
- [ ] **Financial Features**: Declare financial features (No real-money gambling).

### 4. Internal Testing Track (MANUAL_PENDING)
- [ ] Navigate to **Testing > Internal testing**.
- [ ] Create a new release.
- [ ] Upload the signed `app-release.aab`.
- [ ] Enter Release Notes (refer to `RELEASE_NOTES_V1.md`).
- [ ] Define the internal tester list (email addresses).
- [ ] Save and Review the release.

### 5. Rollout (MANUAL_PENDING)
- [ ] Roll out the internal testing release.
- [ ] Distribute the opt-in URL to the designated internal testers.

> **IMPORTANT**: The V1.0 release is approved ONLY for Internal Testing at this time. Do not promote to Production or Open Testing until internal testing feedback is collected and verified.
