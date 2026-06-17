# Security & Anti-Cheat Module

This folder contains save file validation, checksum computation, and security event logging.

## Purpose
Secures offline progress, badges, and ELO from manipulation. Automatically resets or restores state from encrypted backup files if tampering is identified.

## Key Files
- `securityLog.ts`: Tracks and logs security violations (e.g. clock manipulation, checksum mismatch).
- `validatePlayerData.ts`: Enforces boundaries, streaks, ELO limits, and ELO consistency.

## Related Phase Documentation
- `docs/phases/PHASE_17_SAVE_SECURITY_ANTICHEAT.md`

## Test Command
```bash
npx vitest run src/game/security
```

## Do-Not-Break Notes
- Any modifications to player data schemas must update the verification boundaries inside `validatePlayerData.ts`.
