# Backend Schema Document - Clash of Crowns

## 1. Firestore System Design (DATABASE_SCHEMA)
Clash of Crowns utilizes a highly robust, local-first schema running in **Cloud Firestore** for user accounts, progress tracking, and match logs.

### A. Collection: `users` (Primary Profile Schema)
*   *Path:* `/users/{uid}`
*   *Description:* Represents full player metadata, settings, themes, and game statistics.

```json
{
  "uid": "string (Firebase Auth Unique Identifier)",
  "name": "string (Player Name or Custom Display Name)",
  "photoURL": "string (Google Login Avatar URL)",
  "isPremium": "boolean (Stripe tier validation flag)",
  "tier": "number (Current progression stage, 0-26)",
  "rating": "number (Live calculated ELO rating, default: 400)",
  "wins": "number (Match win count)",
  "losses": "number (Match loss count)",
  "draws": "number (Match draw count)",
  "streak": "number (Current consecutive win count)",
  "bestStreak": "number (All-time longest win streak)",
  "consecLoss": "number (Current consecutive loss counter)",
  "hardLocked": "boolean (Anti-cheating / safety locked profiles)",
  "dailyUndoCount": "number (Count of daily undos used)",
  "lastUndoDate": "string (ISO Standard Date string, e.g., '2026-06-08')",
  "language": "string (Preferred language: 'en' | 'hi' | 'ur' | 'ar')",
  "viewMode": "string (Preferred board view: '2d' | '3d')",
  "boardTheme": "string (Board skin selection: 'classic' | 'wood' | 'marble' | 'neon')",
  "selectedPieceSet": "string ('classic' | 'royal' | 'literature' | 'sports' | 'modern')",
  "musicOn": "boolean (User sound controls)",
  "sfxOn": "boolean (User sound controls)",
  "showHints": "boolean",
  "undoEnabled": "boolean",
  "whiteWins": "number",
  "whiteLosses": "number",
  "blackWins": "number",
  "blackLosses": "number"
}
```

### B. Collection: `/friendRequests` (Social Mesh)
*   *Path:* `/friendRequests/{requestId}`
*   *Description:* Social connection requests between chess competitors.
```json
{
  "from": "string (UID of requesting user)",
  "to": "string (UID of target user)",
  "status": "string ('pending' | 'accepted' | 'declined')",
  "timestamp": "serverTimestamp"
}
```

### C. Subcollection: `/chats` (Real-Time Communication Logs)
*   *Path:* `/chats/{chatId}/messages/{messageId}`
*   *Description:* High-speed chat logging for messaging screens.
```json
{
  "sender": "string (UID of message sender)",
  "text": "string (Message body)",
  "timestamp": "serverTimestamp"
}
```

---

## 2. Server APIs & Middleware Strategy (BACKEND_SCHEMA)

### A. API Endpoints (Express Proxy)
Because client-side keys are isolated from the browser, all sensitive transactions route through backend controller functions.
*   **POST `/api/payments/create-checkout`:** Spawns a secure Stripe checkout session to purchase Premium upgrades. On payment success, updates the user's `isPremium` field in Firestore via Admin SDK.
*   **POST `/api/analysis/evaluate-position`:** Calls secondary Gemini models server-side safely using `process.env.GEMINI_API_KEY` to explain complex chess tactics and blunder positions to learners.

---

## 3. Security Rules Configuration (firestore.rules)
Database permissions are explicitly configured to protect system fields from unauthorized client-side updates:
1. Users can query any user's public ELO and scoreboard statistics to populate Leaderboards.
2. Users can **ONLY** write or modify records belonging directly to their own UID document (`request.auth.uid == userId`).
3. Sensitive fields like `isPremium` can be locked so they can only be changed via server-side Admin SDK scripts (`request.resource.data.isPremium == resource.data.isPremium`).
