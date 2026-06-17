# Privacy & Data Safety Notes (v1.0)

For the Google Play Store Data Safety Questionnaire, the following technical facts apply to Clash of Crowns v1.0:

## Data Collection & Usage
- **Firebase Authentication**: We collect anonymous or Google/Email identities if the user chooses to sign in. Passwords are handled securely by Firebase and never touch our servers in plain text.
- **Cloud Save Data**: We collect player progression data (Coins, XP, unlocked characters, Elo) and back it up to Firestore. This data is tied to the user's UID and used exclusively for App Functionality.
- **Leaderboard Data**: The user's Display Name, Avatar ID, and Comp Elo are saved publicly to the leaderboard collection if they connect to the internet.
- **Local Storage**: For users playing without logging in, all progression is saved strictly offline using `localStorage` or Capacitor native storage.
- **Crash/Logging**: (If Firebase Crashlytics/Analytics is enabled) standard app performance metrics are collected. **No PII** (Personally Identifiable Information) or raw secrets/tokens are ever logged in debug logs or analytics.

## Data Sharing & Selling
- We **DO NOT** sell user data to third parties.
- Data is only shared with our infrastructure provider (Google Firebase) to provide core app functionality.

## Data Deletion
- **[TODO for future]**: In-app "Delete Account" button must be functional to comply with Play Store policies (or provide a web link for account deletion requests).
