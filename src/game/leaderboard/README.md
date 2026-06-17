# Leaderboards Module

This folder manages Elo calculation, wins, match stats, and leaderboards.

## Purpose
Enforces the dual-leaderboard system: Comp Kings (for offline vs computer progression) and Arena Kings (for live friend matches).

## Key Files
- `compLeaderboardService.ts`: Uploads verified Comp Elo, streak, and grandmaster progress.
- `arenaLeaderboardService.ts`: Manages Arena ELO scores.
- `leaderboardSecurity.ts`: Validates data structures to block client-side ELO cheating.

## Related Phase Documentation
- `docs/phases/PHASE_22_DUAL_LEADERBOARD_COMP_ARENA.md`

## Test Command
```bash
npx vitest run src/game/leaderboard
```

## Do-Not-Break Notes
- Never upload leaderboard entries without passing the data validation checks inside `leaderboardSecurity`.
