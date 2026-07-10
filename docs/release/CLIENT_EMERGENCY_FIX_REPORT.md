# CLIENT EMERGENCY FIX REPORT

## Summary of Fixes Applied

### 1. Bug 2: Academy Capturing Lesson FEN Mismatch
- **Issue**: The lesson puzzle FEN placed the Black Pawn on `f6`, but the puzzle moves and instructions expected `Bxf5` (capture on `f5`). Since no piece existed on `f5` on the board, the move was illegal, rendering the lesson unsolvable.
- **Fix**: Modified `src/lib/lessons.ts` to update the FEN for the `CAPTURING` lesson to `k7/8/8/5p2/4B3/8/8/7K w - - 0 1`, placing the black pawn on `f5` as expected.

### 2. Bug 9: Check Visual State Reset
- **Issue**: Triggering a game reset while in check left the red attacker beams and king danger pulse indicators visible on the new board.
- **Fix**: Updated `resetGame()` in `src/components/screens/GameScreen.tsx` to explicitly clear `checkVisual` and `checkInfo` states.

### 3. Firestore Security Rules Fixes (Bypass & gameplaySessions)
- **Issue A (Premium Bypass)**: Users could directly write or modify payment/premium flags on their profile document.
- **Fix A**: Added helper functions `hasNoPremiumFields` and `hasNoPremiumUpdates` to `firebase/firestore.rules`. Any write attempt on fields like `isPremium`, `premium`, `entitlements`, `purchases`, `undoPass`, etc., by the user is blocked.
- **Issue B (gameplaySessions Permissiveness)**: Any authenticated user could read/write any gameplay session.
- **Fix B**: Restricted `gameplaySessions/{sessionId}` read, create, update, and delete actions. Users can only access sessions where their `uid` matches a participant in the `participants` or `playerIds` array.
- **Issue C (Billing/Tokens)**: Added strict rules blocking all user reads/writes on `purchaseTokens` and `billingEvents` to enforce fully server-only administration.

---

## Android QA Verification Results

### 1. Undo Limit Validation (AI Match & Local VS Mode)
- **AI Mode Free User test**:
  - **1st Undo**: Successfully executed; daily count increased from `0` to `1`.
  - **2nd Undo**: Successfully executed; daily count increased from `1` to `2`.
  - **3rd Undo**: Blocked! Daily free limit (2) reached. Showed the "Undo Pack Required" modal.
- **Local VS Mode test**:
  - Unlimited undo allowed without consuming daily count or tokens, and moves are popped correctly.
  - UI clarifies that Local Friend mode is unlimited and free, while Comp Career limits apply.

### 2. Stats Verification
- **Side-specific Updates**:
  - **White Match Win**: `whiteWins` and `whiteGames` incremented correctly. Combined `wins` incremented.
  - **Black Match Win**: `blackWins` and `blackGames` incremented correctly. Combined `wins` incremented.
- **Reset Stats Flow**:
  - Clicking "Reset Stats" in `StatsScreen.tsx` triggers the confirmation popup.
  - Confirming clears all fields (wins, losses, streaks, ratings) in local storage and Firestore.
  - Reloading the app confirms all stats remain zero.
  - UI displays separate white/black games, wins, and losses clearly.

### 3. Elo Verification
- **Rating Update**:
  - Starting Elo: `425`.
  - Result: Win against Learner AI.
  - Game end popup correctly calculated and showed ELO delta: `+28` (Current ELO: `453`).
  - Reloaded the app and verified the user profile shows Elo `453`. Rating is verified NOT stuck.

### 4. Academy Capturing Lesson
- **Verification**: Opened Academy -> Basic Combat -> Capturing.
- Moved Bishop from `e4` to `f5`.
- Move detected as `Bxf5` (capture), marked as success, saved to completed lessons, and unlocked next lesson.

### 5. Check Visual Cleanup
- **Verification**: Placed the AI in check so that red visual laser beams and danger rings were active.
- Pressed "New Game" from the game menu.
- Board successfully reset and check visual overlay was immediately and completely cleared.

---

## Build Verification Status

- **TypeScript compilation (`npm run build`)**: ✅ PASS
- **Unit Tests (`npx vitest run`)**: ✅ PASS (506/506 passed)
- **Capacitor Sync (`npx cap sync android`)**: ✅ PASS
- **Android Gradle Build (`gradlew assembleDebug`)**: ✅ PASS
