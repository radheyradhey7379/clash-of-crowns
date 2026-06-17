# Tournament Resume Point

## Completed Phases
*(Tournaments logic has not been fully implemented yet)*

## Current Internal Working State
Tournaments are a planned feature but remain a placeholder in the UI for v1.0.

## Reason Disabled for v1.0
Tournaments require bracket logic, scheduling, and massive concurrent player handling which is beyond the scope of v1.0.

## Feature Flags Controlling It
- `VITE_ENABLE_TOURNAMENTS=false`

## Code Markers
Search the codebase for: `START_HERE_TOURNAMENT_RESUME` and `TOURNAMENT_PAUSED_FOR_V1`.

## Next Steps to Resume
1. Change `VITE_ENABLE_TOURNAMENTS` to `true`.
2. Build the Tournament Backend architecture (brackets, rounds, matchmaking).

## Required Security Conditions Before Enabling Publicly
- Same strict authoritative constraints as Ranked Arena.
