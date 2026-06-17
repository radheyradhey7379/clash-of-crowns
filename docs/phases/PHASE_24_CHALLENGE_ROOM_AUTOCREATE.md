# Phase 24: Accepted Challenge → Friend Room Auto-Creation

This document outlines the design, implementation, and verification of the Friend Room Auto-Creation system triggered by accepting a friendly duel challenge in Clash of Crowns.

---

## 1. Goal & Principles

- **Auto-Room Creation**: When a receiver accepts a Friend Duel challenge request, automatically create a Friend Match multiplayer room, attach the `roomId` to the challenge, and allow both players to enter the match from the Court Chat inbox.
- **Transactional Safety**: The challenge status update and multiplayer room creation must happen atomically within a Firestore transaction to prevent inconsistent states.
- **No Poke Room Creation**: Poke requests are social pings and must not result in room auto-creation.
- **Aesthetics & Layout Preservation**: The existing UI structure, chat list, modals, layouts, and multiplayer flows remain unchanged. Only back-end logic and entry hooks are introduced.

---

## 2. Technical Implementation Details

### A. Extended Data Models
Extended the existing models in:
1. **`src/game/social/challengeTypes.ts`**:
   - `ChallengeRequest`: Added optional fields `roomId: string`, `roomStatus: 'created'`, and `acceptedAt: number`.
   - `ChatInboxMessage`: Added optional `roomId?: string` and `actionLabel?: string` (e.g. `'ENTER MATCH'`).
2. **`src/game/multiplayer/multiplayerTypes.ts`**:
   - `MultiplayerRoom`: Added fields `hostColor: 'w'`, `guestColor: 'b'`, `mode: 'friend'`, `source: 'challenge'`, and `challengeRequestId?: string`.

### B. Transaction-Based Acceptance (`acceptChallengeAndCreateRoom`)
Implemented in `src/game/social/challengeRoomService.ts` using Firestore `runTransaction`:
1. **Fetch Challenge**: Reads the `challengeRequest` document.
2. **Double Accept Check**: If status is already `'accepted'` and `roomId` exists, returns the existing `roomId` immediately without creating a new room.
3. **Receiver Validation**: Ensures that the caller `receiverUid` matches the challenge's target `toUid`.
4. **Status Check**: Enforces that the challenge status must be `'pending'` or `'seen'`.
5. **Expiry Check**: Ensures the challenge is not expired (`expiresAt > Date.now()`).
6. **Poke Exclusion**: If the request `type` is `'poke'`, it updates the status to `'accepted'` and writes `acceptedAt` but bypasses room creation.
7. **Deterministic Room ID**: Generates a collision-safe ID based on the challenge ID:
   ```typescript
   const roomId = "CH-" + challengeId.slice(0, 8);
   ```
8. **Create Room Document**: Sets up the room in `/multiplayerRooms/{roomId}` with `status: 'ready'`, `source: 'challenge'`, `hostUid: challenge.fromUid`, and `guestUid: challenge.toUid`.
9. **Update Challenge Document**: Sets the challenge status to `'accepted'`, attaches the generated `roomId`, sets `roomStatus: 'created'`, and sets the `acceptedAt` timestamp.

### C. Role and Color Assignment
The role assignments are strictly deterministic:
- **Challenger (`fromUid`)** $\rightarrow$ **Host** with color `'w'` (White).
- **Receiver (`toUid`)** $\rightarrow$ **Guest** with color `'b'` (Black).
The player executing the transaction (the receiver/guest) does not change this mapping; roles and colors remain tied to the original challenge direction.

### D. Post-Transaction Notifications & Chat Inbox Updates
To guarantee that room creation is not blocked by non-essential inbox or notification failures, all post-transaction writes are executed outside the transaction block and wrapped in try-catch structures:
1. **Notifications**: Writes notification objects for both the host and guest indicating the match is ready.
2. **Chat Inbox**: Updates the receiver's inbox message status and creates a notification/link card in the challenger's inbox.
3. **Fail-Safety**: If notification or inbox updates fail, the room remains active and the challenge remains accepted. The function returns partial success safely.

---

## 3. Room Entry & Screen Navigation

### A. Navigation Configuration (`enterChallengeRoom`)
Implemented in `src/game/social/challengeRoomService.ts` to coordinate secure transition:
- Checks if the challenge, `roomId`, and target room exist in Firestore.
- Verifies that the navigating user's `uid` is either `fromUid` (host) or `toUid` (guest).
- Checks that the room status is `'ready'` or `'active'`.
- Returns the navigation configuration: `{ roomId, role: 'host' | 'guest', color: 'w' | 'b' }`.

### B. ChatScreen UI Integration
- When the receiver views a pending or seen challenge request in the inbox modal, clicking the **ACCEPT** button calls `acceptChallengeAndCreateRoom()`.
- Once accepted, the interface renders a golden **ENTER MATCH** button.
- Clicking **ENTER MATCH** calls `enterChallengeRoom()` to fetch the correct configuration, clears the local previews, and invokes:
  ```typescript
  onNavigate('Game', null, null, config);
  ```
  This securely launches the game screen using the existing multiplayer flow.

---

## 4. Firestore Security Rules

Enforced in `firestore.rules` to authorize transactions and secure documents:
1. **Challenge Request Update**:
   - Enforces that only `toUid` can change the status to `'accepted'`.
   - Enforces that an acceptance update must supply a valid `roomId`.
   - Restricts read permissions exclusively to `fromUid` and `toUid`.
2. **Multiplayer Room Creation**:
   - Allows the host (`hostUid == auth.uid`) to create a room.
   - Allows the guest (`guestUid == auth.uid`) to create a room only if the room's `source == 'challenge'`, `challengeRequestId` is present, and `get()` queries verify that the challenge's UIDs match the room's host/guest settings.

---

## 5. Verification & Testing

### Automated Vitest Suite (`src/game/social/__tests__/challenge.test.ts`)
A suite of 24 test cases verifies all aspects of challenge room creation:
- **Challenge Acceptance**: Creates a deterministic room with correct host/guest roles and white/black colors.
- **Poke Acceptance**: Updates status but does not create a room.
- **Double Acceptance**: Returns the existing `roomId` on multiple accept calls and avoids duplicates.
- **Spam and Validation**: Rejects non-receivers, expired requests, and declined requests.
- **Authentication**: Offline or unauthenticated calls are blocked safely.
- **Fail-Safety**: Failures in notifications or chat inbox updates do not rollback room creation.
- **Config Compilation**: `enterChallengeRoom` outputs correct parameters for both players and blocks strangers.

### Build and Lint Output
- All TypeScript compiler errors resolved.
- `npm run lint` compiles cleanly with no emissions (`tsc --noEmit`).
- `npm run build` succeeds, generating minified production assets.
