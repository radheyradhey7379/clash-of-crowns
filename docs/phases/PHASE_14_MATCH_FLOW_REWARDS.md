# Phase 14: Match Flow Integration + Rewards + Unlock Validation

This document outlines the final technical architecture and implementation details for **Phase 14: Match Flow Integration + Rewards + Unlock Validation** in *Clash of Crowns*.

---

## 1. Goal Achievements
Complete the end-to-end local-first AI match loop:
`Select character` → `Validate unlock status` → `Apply character style & difficulty configuration` → `Perform match with routed AI engine` → `Process progression updates` → `Calculate coins, XP, and badges` → `Persist player data` → `Display details in the existing Game Over modal`.

---

## 2. Implemented Architecture

### A. Core Types & Storage Additions
1. **`PlayerData` updates (`src/types/index.ts`)**:
   - Added optional `coins?: number`, `xp?: number`, and `badges?: string[]` fields.
2. **`DEFAULT_PLAYER_DATA` (`src/lib/store.ts`)**:
   - Initialized `coins: 0`, `xp: 0`, and `badges: []` as system defaults.
3. **`AIMatchResult` updates (`src/types/aiProgression.ts`)**:
   - Expanded to hold: `characterId`, `tier`, `result` (`'win' | 'loss' | 'draw'`), `reason` (`'checkmate' | 'resign' | 'timeout' | 'draw'`), `eloBefore`, and `timestamp`.
   - Maintained optional `playerWon` and `isDraw` fields for complete backward compatibility.

### B. Progression & Selection Validation (`src/game/ai/progressionEngine.ts`)
1. **`getCurrentPlayableCharacterId(progress)`**:
   - Translates progression state (tier, level, cup series, GM boss) to the specific character ID the user should target.
2. **`validateCharacterSelection(characterId, progress)`**:
   - Validates if a selected character is unlocked (current playable level or previously unlocked/completed level).
   - Blocks future locked characters, locked Hard tier, locked Master cups, and locked Grandmaster boss modes.
   - Provides safe fallback to the current playable character ID in case of invalid or missing inputs.

### C. Rewards System (`src/game/ai/aiRewards.ts`)
1. **Match Rewards**:
   - **Win**: +50 coins, +100 XP
   - **Loss**: +10 XP, +0 coins
   - **Draw**: +20 coins, +40 XP
2. **Bonus Rewards**:
   - **Tier Unlock**: +200 coins
   - **Master Cup Clear**: +500 coins
   - **Grandmaster Boss Defeated**: Awards unique badge `"Grandmaster Boss Slayer"`.
3. **Badge Uniqueness**:
   - Service filters badges to prevent duplicate awarding.

### D. Match Flow Service Orchestration (`src/game/ai/matchFlowService.ts`)
Creates a clean separation of concerns between UI rendering and business logic:
- `validateCharacter`: validates selection and retrieves fallback if necessary.
- `processMatchResult`: compiles the match details, executes `applyAIMatchResult()`, invokes `calculateAIMatchRewards()`, appends badges uniquely, updates wins/losses/draws, and returns the modified `PlayerData` state for saving.

### E. AI Difficulty & Routing Integration (`src/components/screens/GameScreen.tsx`)
1. **Engine Routing**:
   - Characters in **Core, Beginner, and Learner** use the internal simple JS engine.
   - Characters in **Intermediate, Hard, Master, and Grandmaster** use the asynchronous Stockfish Web Worker.
2. **AI Personality Modifiers (`src/lib/chess-logic.ts`)**:
   - Adjusted `evaluateBoard()` to apply safe evaluation weights based on character configurations:
     - `aggression`: Manhattan distance bonus to squares near the opponent's king.
     - `defense`: Manhattan distance bonus to squares near the friendly king.
     - `openingKnowledge`: early game center square control (d4, d5, e4, e5) priority.
     - `endgameSkill`: promotion and advanced pawn pushing incentives.
3. **Stockfish Contempt Option (`src/services/stockfishService.ts`)**:
   - Dynamically sets Stockfish's UCI `Contempt` option based on character aggression and defense.

### F. Result UI (`src/components/screens/GameScreen.tsx`)
Injected detailed match data directly into the existing Game Over modal layout:
- Win/Loss/Draw outcome with custom titles.
- ELO changes (+ / - / ±0).
- Gained Coins and XP indicators.
- Milestone alerts: unlocked badges, completed Master cups, and tier unlocks.
- Cup series standings (Wins/Losses out of 4 matches) for Master tier.
- Boss fight series standings (Wins/Losses out of 3 matches) for Grandmaster tier.
- The next unlocked character card name.

---

## 3. Verification & Test Suite

### Automated Unit Tests (`src/game/ai/__tests__/progression.test.ts`)
Added comprehensive test coverage:
1. Validating that selecting locked future characters is blocked.
2. Validating that previously completed characters remain playable.
3. Validating that invalid character IDs fallback correctly.
4. Testing Win, Loss, and Draw reward calculations.
5. Verifying that ELO updates and locks/unlocks behave properly on win/loss/draw.
6. Verifying that Master cup clears advance cup series.
7. Verifying that the Grandmaster boss series operates on a best-of-3 wins check.
8. Testing that badges are not duplicated in the player's profile.

Running the tests:
```bash
npx vitest run src/game/ai/__tests__/progression.test.ts
```
**Result**: 28/28 tests passed successfully.

### Build & Compilation Checks
- `npm run lint` - Clean, 0 compile errors.
- `npm run build` - Clean production build completed.
