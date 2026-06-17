# Firestore Rules Deployment Report

This report documents the security protections and deployment tracking for Firestore access control rules.

## 1. Hardened Security Rules Configuration
The security rules inside `firestore.rules` protect database integrity against client-side spoofing:
- **No Hardcoded Admin Emails**: Removed all legacy email checks. Administration is managed via Custom Claims (`request.auth.token.admin == true`) or database profiles (`resource.data.role == 'admin'`).
- **Blocked Client ELO Updates**: Users are prevented from modifying rating-related fields on `/users/{userId}`. Updates to `rating`, `arenaRating`, `wins`, `losses`, `draws`, `tier`, `char`, and `appliedArenaResultIds` are blocked for standard users:
  ```javascript
  isUnchanged('rating') && isUnchanged('arenaRating') && ...
  ```
- **Read-Only Tournaments**: The `/tournaments/{tournamentId}` collection is writable only by admins (`isAdmin()`). Clients can only read tournament brackets.
- **Protected Leaderboards**: Direct client writes to `/leaderboards/arena_kings/entries/{userId}` are blocked. The Node.js backend handles updates securely using the Admin SDK.
- **Social Collections**: Added owner access constraints on `/friendRequests` and `/chats` to prevent unauthorized eavesdropping.

## 2. Deployment Instructions
Deploy rules to production:
```bash
firebase deploy --only firestore:rules --project <your-firebase-project-id>
```

## 3. Post-Deployment Verification Checklists
- [ ] Read `/users/{uid}` profile as owner -> Allowed.
- [ ] Attempt client write to `arenaRating` field -> Rejected (Permission Denied).
- [ ] Attempt client write to `/leaderboards/arena_kings/entries/{uid}` -> Rejected (Permission Denied).
- [ ] Write to `/leaderboards/comp_kings/entries/{uid}` (Career mode) -> Allowed.
- [ ] Read tournament brackets -> Allowed.
- [ ] Attempt client write to `/tournaments/{id}` -> Rejected (Permission Denied).

## 4. Final Status
**MANUAL_PENDING**. Uploading rules to the live Firebase console requires developer authentication.
