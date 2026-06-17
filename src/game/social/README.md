# Social & Friendly Duels Module

This folder manages social interactions, chat notifications, inbox logs, and player pokes.

## Purpose
Coordinates the poke/challenge sequence, delivering real-time notification alerts and court chat logs so players can easily initiate friendly duels.

## Key Files
- `challengeRoomService.ts`: Accepts friendly duels and auto-creates Friend Match lobbies.
- `chatInboxService.ts`: Syncs challenge cards and duel requests directly into users' chat streams.
- `notificationService.ts`: Writes notifications for challenge events.
- `challengeTypes.ts`: Configuration structures for duels and pokes.

## Related Phase Documentation
- `docs/phases/PHASE_23_POKE_CHALLENGE_CHAT.md`
- `docs/phases/PHASE_24_CHALLENGE_ROOM_AUTOCREATE.md`

## Test Command
```bash
npx vitest run src/game/social
```

## Do-Not-Break Notes
- Challenge room color logic requires: Host = White, Guest = Black.
- The challenge-accepted lobby roomId is created deterministically and must match the ID fed into the Rust server bridge.
