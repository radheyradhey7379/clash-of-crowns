# Cloud Synchronization Module

This folder manages synchronization between local stores and Firebase Firestore.

## Purpose
Ensures client data is backed up to Firestore when online. Resolves merge conflicts (e.g. comparing local changes vs cloud backups based on update timestamps).

## Key Files
- `cloudSyncManager.ts`: Coordinates synchronization on connectivity restore.
- `cloudSaveService.ts`: Reads/writes encrypted game states to Firestore.
- `cloudConflictResolver.ts`: Merges records and resolves conflicts.

## Related Phase Documentation
- `docs/phases/PHASE_19_CLOUD_SAVE_FIREBASE_SYNC.md`

## Test Command
```bash
npx vitest run src/lib/cloud
```

## Do-Not-Break Notes
- Never sync unencrypted payloads; ensure state passes through `protectedSave` prior to upload.
