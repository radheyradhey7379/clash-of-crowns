# Comp Career Flow (Phase 33A)

## Overview
Comp Career is the primary offline single-player mode. Players progress through 8 tiers, defeating increasingly difficult AI opponents.

## Progression Rules

### 1. Core to Hard (Standard Tiers)
- Each tier contains a set of characters.
- Defeating the final character in a tier unlocks the next tier.
- Losing matches can cause the player to drop levels within the current tier, but players cannot drop below Level 1 of their current tier, nor can they drop down to a previous tier.
- **Promotion Trial**: At the end of Learner, the player must pass a Promotion Trial to unlock Intermediate.
- **Hard Lockout**: Losing the first match in Hard tier immediately relocks Hard and drops the player back to Intermediate Level 8.

### 2. Master (Cup Series)
- The Master tier is divided into 3 Cups.
- Each Cup consists of 4 matches.
- The player must win at least 3 out of 4 matches to clear the Cup and advance to the next one.
- Failing to secure 3 wins requires retrying the current Cup from match 1.
- Clearing Cup 3 unlocks the Grandmaster tier.

### 3. Grandmaster (Crownless King)
- The Grandmaster tier consists of a single "Boss" series.
- The player plays a Best-of-3 series against the Crownless King.
- Winning the series awards the "Grandmaster Boss Slayer" badge.

## Anti-Cheat and Idempotency
- **Match Finalization**: `matchFlowService.processMatchResult` runs transactionally.
- Matches are guarded against duplicate submission via `clash_completed_matches` cache.
- Fast completions (under 2 seconds) are rejected.
- Elo jumps over 50, coin jumps over 750, and XP jumps over 150 per match are clipped and flagged.
- `totalMatchesCompleted` prevents users from starting a fresh save and jumping straight to Master without playing the requisite number of games (Stricter bounds apply to `saveVersion >= 2` accounts).
