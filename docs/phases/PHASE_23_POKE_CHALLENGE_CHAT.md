# Phase 23: Poke / Challenge + Chat Notifications

This document outlines the design, implementation, and verification of the Poke/Challenge and Chat Notifications system for Clash of Crowns. The system enables players to poke or challenge top players from either the **Comp Kings** or **Arena Kings** leaderboards, delivering requests to the target's Firestore subcollections (`notifications` and `chatInbox`), and allows the target to view the challenger's profile and Accept/Decline the challenge in Court Chat.

---

## 1. Goal & Principles

- **Leaderboard Engagement**: Allow authenticated players to interact with others on the Comp Kings and Arena Kings leaderboards.
- **Spam and Limit Constraints**: Protect players from notification flooding through cooldowns, daily quotas, duplicate checks, message sanitization, and blocking of links.
- **Inbox & Notification Isolation**: Enforce strict Firestore security rules preventing unauthorized users from writing arbitrary messages, read flags, or notification content in another user's subcollections.
- **Robust Creation Order**: Ensure `ChallengeRequest` is persisted before creating target notification and inbox references. If subcollection writes fail, keep the challenge request intact and return a partial success without crashing the client.
- **Verification Integrity**: A complete Vitest suite covering validation rules, expiry enforcement, duplicate replacement, and player preview generation.

---

## 2. Technical Implementation Details

### A. Data Types & Interfaces
Defined in `src/game/social/challengeTypes.ts`:
- **`ChallengeRequest`**: Tracks root request fields including ID, sender/receiver details, type (`'poke' | 'challenge'`), status (`'pending' | 'seen' | 'accepted' | 'declined' | 'expired'`), chess-themed message, and 24-hour expiration dates.
- **`ChatNotification`**: Represents notification collection document structures under `users/{toUid}/notifications/{notifId}`.
- **`ChatInboxMessage`**: Represents chat-focused document structures under `users/{toUid}/chatInbox/{msgId}`.
- **`PlayerPublicPreview`**: Aggregates ranking, ELO, multiplayer win/loss/draw counts, and earned badges for interactive challenger preview cards.

### B. Spam Protection & Validation Rules
Defined in `src/game/social/challengeValidation.ts`:
- **Self-Challenges**: Blocked locally and validated via Firestore rules (`fromUid != toUid`).
- **Authentication Check**: Blocks unauthenticated pokes/challenges.
- **Target Cooldown**: Enforces a 10-minute cooldown window per target to prevent spamming pokes.
- **Daily Quotas**: Restricts players to a maximum of 20 outgoing challenges per 24 hours.
- **Duplicate Pendings**: Prevents submitting a new poke or challenge if there is an active pending or seen request. If the existing pending request is expired, it updates it to `'expired'` in Firestore and allows the new one.
- **Message Sanitization**: Capping messages at 120 characters, trimming leading/trailing whitespace, blocking URLs/links, and falling back to a safe chess-themed default message if empty.

### C. Creation Order & Reference Integrity
Implemented in `src/game/social/challengeService.ts`:
- **`sendPokeChallenge()`**:
  1. Validates target authenticity, duplicate requests, cooldowns, and daily limits.
  2. Creates the `ChallengeRequest` in `/challengeRequests/{challengeId}` first using `setDoc()`.
  3. Writes to `/users/{toUid}/notifications/{notificationId}` referencing `challengeRequestId`.
  4. Writes to `/users/{toUid}/chatInbox/{messageId}` referencing `challengeRequestId`.
  - Sequential writes are wrapped in individual try/catch blocks; if notification or inbox creation fails, the core `ChallengeRequest` is preserved and partial success `{ success: true, challengeRequest }` is returned safely.

### D. Accept/Decline & Expiry Enforcement
Implemented in `src/game/social/challengeService.ts` and `src/game/social/chatInboxService.ts`:
- **Accept**: Only updates challenge request and inbox status to `'accepted'`. No room is created (Friend Match room creation is deferred to Phase 24).
- **Decline**: Updates challenge request and inbox status to `'declined'`.
- **Read-Time Expiry**: When fetching received/sent challenges or subscribing to inbox messages, if `expiresAt < now` (or if inbox message `createdAt + 24 hours < now`), its status is treated as `'expired'` in-memory and updated to `'expired'` in Firestore in the background. Expired challenges block acceptance.

---

## 3. UI and Screen Integration

### LeaderboardScreen.tsx
- Integrated a poke/challenge modal on rows.
- Validates authentic session presence. If unauthenticated, displays toast: `"Sign in to poke or challenge players!"`.
- Displays choice of **POKE** (quick ping) or **CHALLENGE** (custom friendly duel message with a character counter).
- Interacts with `sendPokeChallenge()` and presents feedback toasts.

### ChatScreen.tsx (Court Chat)
- Added a **CHALLENGES** tab.
- Displays incoming pokes/challenges with status badges (`pending`, `seen`, `accepted`, `declined`, `expired`) and unread pings.
- Clicking on a challenge marks the inbox message as read in Firestore and retrieves a public profile preview.
- Opens the **Challenger Preview Modal** showing:
  - Challenger's avatar, name, and title.
  - Rankings and stats across Comp Kings (rank + Elo) and Arena Kings (rank + rating + wins/losses/draws + win rate).
  - Earned badges.
  - Interactive **ACCEPT**, **DECLINE**, and **IGNORE** options for pending/seen requests.
  - **CLOSE VIEW** option for already completed or expired requests.

---

## 4. Firestore Security Rules

Enforced in `firestore.rules`:
```firestore
    // Challenge Requests collection
    match /challengeRequests/{challengeId} {
      allow read: if isAuthenticated() && (request.auth.uid == resource.data.fromUid || request.auth.uid == resource.data.toUid);
      allow create: if isAuthenticated() && request.auth.uid == request.resource.data.fromUid && request.resource.data.fromUid != request.resource.data.toUid;
      allow update: if isAuthenticated() && (
        (request.auth.uid == resource.data.toUid && (request.resource.data.status == 'seen' || request.resource.data.status == 'accepted' || request.resource.data.status == 'declined')) ||
        ((request.auth.uid == resource.data.fromUid || request.auth.uid == resource.data.toUid) && request.resource.data.status == 'expired')
      ) && request.resource.data.id == resource.data.id
        && request.resource.data.fromUid == resource.data.fromUid
        && request.resource.data.toUid == resource.data.toUid;
    }

    // User Notifications collection
    match /users/{userId}/notifications/{notificationId} {
      allow read, update: if isAuthenticated() && request.auth.uid == userId;
      allow create: if isAuthenticated() && 
                    request.resource.data.type == 'challenge_request' &&
                    request.resource.data.fromUid == request.auth.uid &&
                    request.resource.data.toUid == userId &&
                    request.resource.data.read == false &&
                    request.resource.data.challengeRequestId is string &&
                    request.resource.data.challengeRequestId != "" &&
                    request.resource.data.createdAt is number;
    }

    // User Chat Inbox collection
    match /users/{userId}/chatInbox/{messageId} {
      allow read, update: if isAuthenticated() && request.auth.uid == userId;
      allow create: if isAuthenticated() && 
                    request.resource.data.type == 'challenge_request' &&
                    request.resource.data.challengerUid == request.auth.uid &&
                    request.resource.data.toUid == userId &&
                    request.resource.data.read == false &&
                    request.resource.data.challengeRequestId is string &&
                    request.resource.data.challengeRequestId != "" &&
                    request.resource.data.createdAt is number;
    }
```

---

## 5. Verification & Testing

### Automated Tests
A suite of 18 tests was created in `src/game/social/__tests__/challenge.test.ts` verifying:
1. **Self challenge blocked**: Checked validation blocks self-sends.
2. **Unauthenticated blocked**: Checked unauthenticated users are rejected.
3. **Pending duplicate blocked**: Blocked sending duplicate pending challenge.
4. **Expired duplicate replaced**: Replaced duplicate if the existing pending challenge is expired.
5. **Cooldown blocks repeat**: Blocked sends within the 10-minute target cooldown window.
6. **Daily limit blocks after 20**: Blocked sends after exceeding the 20/day limit.
7. **Message length capped**: Truncated and trimmed messages exceeding 120 characters.
8. **Message links blocked**: Checked URL patterns fallback to safe default.
9. **Creation order verified**: Ensured ChallengeRequest is created first, followed by notifications and inbox items.
10. **Reference integrity**: Notification and Inbox documents reference `challengeRequestId` correctly.
11. **Receiver action**: Receiver can accept/decline.
12. **Non-receiver action blocked**: Blocked non-receiver from accepting/declining.
13. **Acceptance expiry block**: Blocked acceptance of expired challenges.
14. **Source wording**: Verified "Comp Kings" and "Arena Kings" source labels compile correctly in messages.
15. **Player preview**: Verified mapping from leaderboard stats and compilation of public preview.

### Test Execution Results
All test suites passed successfully:
- **Social challenge suite (`src/game/social`)**: 18/18 passed.
- **Leaderboard suite (`src/game/leaderboard`)**: 9/9 passed.
- **Multiplayer suite (`src/game/multiplayer`)**: 20/20 passed.
- **Cloud sync suite (`src/lib/cloud`)**: 10/10 passed.
- **Offline suite (`src/lib/offline`)**: 12/12 passed.
- **Security suite (`src/game/security`)**: 20/20 passed.
- **Progression suite (`src/game/ai/__tests__/progression.test.ts`)**: 38/38 passed.
