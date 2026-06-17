# Phase 22: Dual Leaderboard — Comp Kings + Arena Kings

This document outlines the design, implementation, and verification of the Dual Leaderboard system for Clash of Crowns. The leaderboard has been split into two distinct categories: **Comp Kings** (Play vs Computer / Comp Career) and **Arena Kings** (Multiplayer Friend Matches).

---

## 1. Goal & Principles

- **Separation of Concerns**: Players are ranked in two distinct modes. Wording is strictly adhered to, with zero usage of "AI Kings" in the user interface.
- **Offline-First Resilience**: Leaderboard uploads do not block gameplay, save file updates, or match rewards. Offline updates are queued via the local sync queue and synchronized once connection is re-established.
- **Anti-Cheat Validation**: Every player data structure is validated using `validatePlayerData()` before scores are calculated or uploaded, guarding against impossible state progression and ELO injection.
- **Direct Database Security**: Firestore rules restrict writes to a user's own document (`/leaderboards/{mode}/entries/{userId}`), and allow public reads to authenticated users.

---

## 2. Technical Implementation Details

### A. Leaderboard Mode & Data Types
Defined in `src/game/leaderboard/leaderboardTypes.ts`:
- **`LeaderboardMode`**: `"comp_kings" | "arena_kings"`
- **`CompLeaderboardStats`**: Tracks `compElo`, `compTier`, `compWins`, `compMatches`, `compWinStreak`, `completedMasterCups`, `grandmasterDefeated`.
- **`ArenaLeaderboardStats`**: Tracks `arenaRating` (fixed 1200 base for Friend Matches), `arenaWins`, `arenaLosses`, `arenaDraws`, `arenaWinRate`, `arenaMatches`.
- **`LeaderboardEntry`**: Contains the root profile details (UID, displayName, score, avatar, badges, etc.) alongside stats modules.

### B. Scoring Logic
Defined in `src/game/leaderboard/leaderboardScore.ts`:
- **Comp Kings Score Formula**: 
  $$\text{Score} = \text{Comp ELO} + (\text{Completed Cups} \times 500) + (\text{GM Defeated} ? 1000 : 0) + (\text{Streak} \times 50) + (\text{Wins} \times 10) + (\text{Badges} \times 100)$$
- **Arena Kings Score Formula (Provisional Friend Match Logic)**:
  $$\text{Score} = 1200 + (\text{Wins} \times 20) - (\text{Losses} \times 10) + (\text{Draws} \times 5) + (\text{Win Rate \%}) + (\text{Matches} \times 2)$$

### C. Services & Upload Queues
- **`compLeaderboardService.ts`**: Builds and uploads the entry. If offline or if the write fails, enqueues `'comp_leaderboard_update'` in the sync queue. Fills local cache in `localStorage` under `clash_cache_comp_kings` upon successful fetches.
- **`arenaLeaderboardService.ts`**: Computes stats from `playerData.multiplayerHistory` to build and upload the entry. If offline or if the write fails, enqueues `'arena_leaderboard_update'` in the sync queue. Fills local cache in `localStorage` under `clash_cache_arena_kings`.

### D. Rules & Sync Integrations
- **Firestore Rules**:
  ```firestore
  match /leaderboards/{mode}/entries/{userId} {
    allow read: if isAuthenticated();
    allow write: if isOwner(userId) && (mode == 'comp_kings' || mode == 'arena_kings');
  }
  ```
- **Sync Event Queue**: Added `'comp_leaderboard_update'` and `'arena_leaderboard_update'` to the `SyncEvent['type']` union in `syncQueue.ts`.
- **Cloud Sync Manager**: After any successful cloud save operation (`syncNow()`), triggers non-blocking updates of both leaderboard collections with the latest player profile.
- **Computer Matches**: Calls `uploadCompLeaderboardEntry()` non-blockingly at the end of `processMatchResult()` in `matchFlowService.ts`.
- **Multiplayer Matches**: Calls `uploadArenaLeaderboardEntry()` non-blockingly at the end of `addMultiplayerHistoryItem()` in `multiplayerHistoryService.ts`.

---

## 3. UI and Screen Integration

### LeaderboardScreen.tsx
- Modified the tabs to show **Comp Kings** and **Arena Kings** using the existing tab style.
- Fetches and caches data dynamically using React states.
- Shows a loading pulse during active operations.
- Shows the existing-style warning banner: `"Arena ranking will activate with ranked multiplayer"` in the Arena Kings tab.
- Displays player entries and the user's pinned status matching the active tab's columns:
  - **Comp Kings**: `#`, `PlayerName`, `Tier`, `Comp ELO`.
  - **Arena Kings**: `#`, `PlayerName`, `Wins / Losses / Draws`, `Rating`.
- If offline and no local cache is available, shows: `"Leaderboard requires internet"`.

---

## 4. Verification & Testing

### Automated Tests
A suite of 9 tests was created in `src/game/leaderboard/__tests__/leaderboard.test.ts` verifying:
1. **Comp Score Formula**: Verified correct ELO, cups, streak, wins, and badges math.
2. **Arena Score Formula**: Verified correct wins, losses, draws, win rate, and matches math.
3. **Build Entry Methods**: Verified structure maps accurately from player details.
4. **Validation & Security**: Ensured invalid or tampered playerData gets blocked from uploading.
5. **Offline Queueing**: Confirmed offline state correctly enqueues a sync event rather than attempting write or blocking.
6. **Wording Integrity**: Checked that user-facing labels use "Comp", not "AI".
7. **No Ranked Multiplayer ELO Changes**: Checked that base rating remains fixed to 1200.

All Vitest suites, linters, and compilers ran and passed successfully:
- **Leaderboard suite**: 9/9 passed.
- **Multiplayer suite**: 20/20 passed.
- **Cloud sync suite**: 10/10 passed.
- **Offline suite**: 12/12 passed.
- **Security suite**: 20/20 passed.
- **Progression suite**: 38/38 passed.
- **TS Compile (`tsc --noEmit`)**: Successful.
- **Vite Build (`vite build`)**: Successful.
- **Capacitor Sync (`cap sync android`)**: Successful.
