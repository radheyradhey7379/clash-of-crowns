# Settings, Account Center, Help & Support Upgrade Report

This document outlines the design, security, and implementation details for the Settings, Account/Google Sign-In, Help & Support, Data Center, and Privacy/About upgrades completed for Clash of Crowns.

---

## 1. Features Added & Upgraded

### A. Account & Google Sign-In Card (`AccountCard.tsx`)
- **Guest State**: Displays "Guest Player", ELO (starts at 0), and a clear "Sign In" button that routes users directly to the secure Google OAuth progress merging setup.
- **Synced State**: Shows Google Avatar/Shield icon, display name, email, and a "Progress synced" confirmation chip, along with a "Logout" action.
- **Player ID**: Renders a copyable Player ID field with visual verification ("Copied!" tooltip) and audio feedback.

### B. Sound, Graphics & Gameplay Settings Group
- **Sound controls**: Volume toggles for Music, Sound effects, and Vibration.
- **Voice/Commentary toggle**: Added a toggle option for the avatar commentary feature.
- **Low Graphics toggle**: Enables/disables high-performance rendering for web/mobile viewports.
- **Gameplay preferences**: Board mode button selectors (2D/3D), Preferred Side (White/Black), Language (English, Hindi, Urdu, Arabic), and Camera Sensitivity/Font Size sliders.
- **3D Auto-Rotate Turn Toggle**: Added `cameraAutoRotate` to `playerData` to control whether the 3D camera auto-rotates on each player's turn.

### C. Help & Support Accordion Panel (`HelpSupportPanel.tsx`)
- Contains detailed inline FAQ accordions covering account restoration, Player ID lookups, offline engine operation, and online features.
- Includes bug reporting and email support action triggers that format subject lines and basic device info automatically.

### D. Data Center & Privacy Panel (`DataCenterPanel.tsx`)
- **Account Data Viewer**: Renders an inspectable code block with the active local state.
- **Data Export**: Triggers a direct JSON file download containing the player's ELO, stats, and configurations.
- **Delete All My Data**: Implements a strict self-deletion protocol requiring users to type `DELETE` to confirm.

### E. About Panel (`AboutPanel.tsx`)
- Displays app name, version (1.0), versionCode (1), package ID (`com.clashofcrowns.game`), the release build hash, and Apex Optima copyright notice.
- Includes a collapsible section displaying MIT/ISC license notices for open-source libraries.

### F. Community Links (`CommunityLinks.tsx`)
- Displays premium icon shortcuts for YouTube, Instagram, Discord, and Website matching the configured parameters.

---

## 2. Data Deletion Behavior

The self-deletion workflow implements a strict protocol:
1. **User Confirmation**: The user must open the Your Data panel, click "Delete All My Data", and type the exact string `DELETE` in the confirmation field.
2. **Cloud Wiping**:
   - Deletes the Firestore profile record: `users/{userId}`
   - Deletes the active session lock document: `users/{userId}/session/current`
   - Deletes the global leaderboard entries: `leaderboards/{mode}/entries/{userId}`
3. **Authentication Purge**: Deletes the Firebase Auth profile using client-side `auth.currentUser.delete()`. If the auth token has expired/requires recent login, it logs the user out as a fallback.
4. **Local Purge**: Clears all local saves, backups, cache, and preferences via `resetPlayerData()`, then redirects to the starting screen.

---

## 3. Security Protections
- **Firestore Access Control**: Added `allow delete: if isOwner(userId);` to both `/users/{userId}` and `/leaderboards/{mode}/entries/{userId}` collections, ensuring authenticated users can only delete their own data.
- **Admin Lockdowns**: App configuration, World Chat, payment records, and security logs remain completely locked from client write operations.

---

## 4. Verification & Testing

All 15 dedicated settings and account tests have passed within the Vitest framework:

```bash
npx vitest run src/services/account/__tests__/settingsUpgrade.test.ts

 ✓ about_section_shows_version
 ✓ community_links_hidden_if_not_configured
 ✓ google_signin_visible_for_guest
 ✓ logged_in_account_card_shows_profile
 ✓ player_id_copy_button_works
 ✓ help_support_section_opens
 ✓ your_data_section_opens
 ✓ delete_all_data_requires_confirmation
 ✓ guest_delete_all_data_clears_local_data
 ✓ logged_in_delete_all_data_deletes_cloud_profile
 ✓ delete_all_data_logs_user_out
 ✓ restore_purchases_button_safe_when_not_configured
 ✓ settings_modal_mobile_compact
 ✓ settings_no_horizontal_overflow_mobile
 ✓ desktop_settings_layout_unchanged
```

---

## 5. Remaining Limitations
- **Google Sign-In WebViews**: Google popup OAuth is disabled on Android native emulator WebViews (Capacitor) during testing builds, falling back to direct guest sessions to prevent sandbox browser blockages.
