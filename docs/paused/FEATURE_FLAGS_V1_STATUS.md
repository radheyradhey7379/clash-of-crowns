# Feature Flags v1.0 Status

| Feature Name | Env Flag | v1.0 Status | Reason Disabled | Resume Phase | Related Files |
|---|---|---|---|---|---|
| **Multiplayer** | `VITE_ENABLE_MULTIPLAYER` | `false` | Awaiting server-authority and scaling stress tests. | Phase 38+ | `HomeScreen.tsx`, `StartGameModal.tsx`, `multiplayerRoomService.ts` |
| **Rust Realtime** | `VITE_ENABLE_RUST_REALTIME` | `false` | Needs production deployment & TLS. | Phase 38+ | `realtimeMultiplayerAdapter.ts`, `rustRoomBridge.ts` |
| **Ranked Arena** | `VITE_ENABLE_RANKED_ARENA` | `false` | Awaiting matchmaking and anti-cheat validation. | Phase 39+ | `LeaderboardScreen.tsx`, `arenaRankedService.ts` |
| **Social Poke** | `VITE_ENABLE_SOCIAL_POKE` | `true` | Harmless social ping without matchmaking risks. | - | `LeaderboardScreen.tsx`, `challengeService.ts` |
| **Challenge Match** | `VITE_ENABLE_CHALLENGE_MATCH` | `false` | Follows multiplayer restrictions. | Phase 38+ | `ChatScreen.tsx`, `challengeRoomService.ts` |
| **Tournaments** | `VITE_ENABLE_TOURNAMENTS` | `false` | Backend not yet built. | Phase 40+ | `LeaderboardScreen.tsx` |

## Remote Control Precedence (Phase 31B)
A secure Version Gate has been added. Feature availability is now determined by combining local `.env` flags and the remote Firestore config (`appConfig/versionGate/current`).

**Rule:** A feature is enabled **ONLY IF**:
1. Local `.env` flag is `true`
2. AND Remote config `maintenanceMode` is `false`
3. AND Remote config does not explicitly list the feature in `disabledFeatures` array
4. AND Remote config explicitly sets the feature to `true` (e.g. `multiplayerEnabled: true`).

This ensures that the remote config can only disable features, or enable features that are already marked safe in the local build. It cannot accidentally enable broken/incomplete features for clients.

## Service Layer Enforcement (Phase 32A)
To prevent circumvention by modified clients or offline cache poisoning, feature constraints are also enforced at the service boundary. For example, `arenaLeaderboardService.ts` will strictly drop local leaderboard updates and refuse to enqueue offline packets if `VITE_ENABLE_RANKED_ARENA` is false, independent of UI masking.
