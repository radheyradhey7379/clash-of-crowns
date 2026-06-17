# Offline Capabilities Module

This folder manages offline logic, network event logging, and local cache.

## Purpose
Ensures core features (e.g. computer play, progressions) remain functional without internet. Queues mutations in a local database and applies them on network recovery.

## Key Files
- `networkStatus.ts`: Dispatches real-time online/offline connection state changes.
- `syncQueue.ts`: Queues unsynced updates in localStorage.
- `offlinePackage.ts`: Tracks cache updates for assets and WebAssembly binaries.
- `offlineCapabilities.ts`: Guards and prevents network features when offline.

## Related Phase Documentation
- `docs/phases/PHASE_18_OFFLINE_AI_RUNTIME.md`

## Test Command
```bash
npx vitest run src/lib/offline
```

## Do-Not-Break Notes
- Keep offline Stockfish and lessons available when offline.
- Do not let sync queue overflow; clean up synced events after they upload.
