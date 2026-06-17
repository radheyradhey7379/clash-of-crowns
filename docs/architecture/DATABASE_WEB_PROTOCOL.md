# Chess Architecture: Database & WebSocket Protocols

## 1. Database Schema (Firestore)

### `users` (Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `uid` | string | Firebase UID |
| `username` | string | Player display name |
| `elo` | number | Current rating |
| `tier` | number | 0: Beginner, 1: Intermediate, 2: Grandmaster |
| `char` | number | Sub-level within tier |
| `deviceId` | string | FingerprintJS visitorId (Anti-cheat) |
| `isPremium` | boolean | Subscription status |
| `reportsCount` | number | Count of reports for cheating |
| `createdAt` | timestamp | Account creation date |

### `matches` (Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `matchId` | string | Unique match ID |
| `whiteUid` | string | UID of white player |
| `blackUid` | string | UID of black player |
| `status` | string | `playing`, `finished`, `aborted` |
| `fen` | string | Current board state |
| `pgn` | string | Move history in PGN format |
| `startTime` | timestamp | Match start time |
| `lastMoveAt` | timestamp | For timeout detection |

### `reports` (Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `reporterUid` | string | User who reported |
| `targetUid` | string | Reported user |
| `reason` | string | `cheating`, `toxicity`, `stall` |
| `matchId` | string | Context of the report |

---

## 2. WebSocket Protocol (Socket.io)

### Client → Server Events
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `joinGame` | `{ gameId: string }` | Enter a game room |
| `move` | `{ gameId, move, token }` | Submit a move |
| `ping_client` | `{ t: number }` | Latency check (Client time) |
| `resign` | `{ gameId }` | Forfeit the match |

### Server → Client Events
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `moveValidated` | `{ fen, move, turn, isGameOver }` | Broadcast move to room |
| `pong_server` | `{ t: number, server_t: number }` | Latency response |
| `gameEnded` | `{ winner, reason }` | Notify end of match |
| `latencyAlert` | `{ rtt: number }` | Warn user if RTT > 200ms |

---

## 3. Security & Monitoring
*   **Rate Limiting**: Max 5 moves per 2 seconds to prevent spam.
*   **Validation**: Every move passed through `shakmaty` (Rust) or `chess.js` (Node).
*   **Async Monitoring**: `tokio-console` tracking task latencies.
*   **Memory Profiling**: `DHAT` monitoring heap allocations in the Rust engine.
