# Multiplayer Unlock & Premium Pass Design

This document details the online multiplayer gating system and the Premium / Multiplayer Pass concept in *Clash of Crowns*.

## 1. Multiplayer Unlock System

Online multiplayer features are gated to encourage offline single-player career progression, limit matchmaking abuse, and provide options for early access.

### Progression-Based Unlocks (Path A)

Players automatically unlock multiplayer modes by playing the Competitive Career and reaching the specified level or tier milestone:

*   **Casual / Friend Online Match**: Unlocks at Career Level 5 (Mini Monarch) or Tier **Learner** (Level 11+).
*   **Ranked Match**: Unlocks at Career Level 15 (Learner Level 5) or Tier **Intermediate** (Level 21+).
*   **Championship Tournament**: Unlocks at Career Level 20 (Promotion Trial Level 5) or Tier **Hard** (Level 29+).

### Premium Unlock (Path B)

Players can buy passes to bypass progression locks early:

*   **Multiplayer Pass**: Bypasses the progression lock for **Casual / Friend Online Match** and **Ranked Match** (pending anti-abuse verification).
*   **Championship Pass**: Bypasses the progression lock for **Championship Tournament**.

---

## 2. Server-Side Entitlements Architecture

To prevent client-side manipulation (e.g. cheat tools or local state memory editing), premium entitlements are designed defensively using a server-authoritative pattern.

### Data Structure

Entitlements are stored on the user's Firestore document under `/users/{userId}`:

```json
{
  "entitlements": {
    "multiplayerPass": true,
    "championshipPass": false,
    "expiresAt": 1799292800000
  }
}
```

### Security Rules (Firestore)

Normal users are strictly prohibited from writing or editing the `entitlements` field. Only admin processes or cloud functions executing under server authority can grant or modify entitlements.

Under `/firebase/firestore.rules`:
```javascript
allow create: if isAuthenticated() && isOwner(userId) && (!('entitlements' in request.resource.data));

allow update: if isAuthenticated() && isOwner(userId) && isUnchanged('entitlements');
```

---

## 3. Gating Order & Logic

When a user attempts to play an online mode, the client evaluates gates in a deterministic order to provide helpful error messages:

1.  **Maintenance/Version Gate**: Checks if the remote config disables multiplayer or requires a client app update.
2.  **Backend Availability**: Checks if the backend API and Realtime services are online (transitioning from *Waking server...* to *Backend unavailable* on timeout).
3.  **Online Beta Flag (`VITE_ENABLE_ONLINE_BETA`)**: If set to `true`, enables guest testing of Casual Match (no ELO writes).
4.  **Auth/Session**: Ensures guest session is created (for beta) or authenticated user is logged in.
5.  **Progress/Premium Unlock**: Validates if the player level meets the threshold or has a valid pass entitlement.
6.  **Mode Gate**: Handles mode-specific constraints (e.g., Ranked or Tournament E2E staging).
