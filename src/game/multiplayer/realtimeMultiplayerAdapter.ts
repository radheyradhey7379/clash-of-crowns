import { rustRoomBridge } from './rustRoomBridge';
import {
  submitMove as submitFirestoreMove,
  subscribeToMoves as subscribeToFirestoreMoves,
} from './multiplayerMoveService';
import {
  updateRoomFen as updateFirestoreRoomFen,
} from './multiplayerRoomService';
import {
  submitResult as submitFirestoreResult,
  subscribeToResult as subscribeToFirestoreResult,
} from './multiplayerResultService';
import {
  createDrawOffer as createFirestoreDrawOffer,
  subscribeToDrawOffers as subscribeToFirestoreDrawOffers,
  acceptDrawOffer as acceptFirestoreDrawOffer,
  declineDrawOffer as declineFirestoreDrawOffer,
  getActiveDrawOffer as getActiveFirestoreDrawOffer,
} from './multiplayerDrawService';
import {
  setPlayerOnline,
  setPlayerOffline,
  updateLastSeen,
  subscribeToPresence,
} from './multiplayerPresenceService';
import { RealtimeTransport } from './realtimeModeTypes';
import { isMultiplayerEnabled, isRustRealtimeEnabled } from '../../lib/config/featureFlags';
import { setRustHealth } from '../../lib/config/featureAvailability';
import { getApiUrl } from '../../services/apiClient';
import { auth } from '../../firebase';
import { currentSessionId } from '../../services/sessionLock';

export interface AdapterConfig {
  roomId: string;
  role: 'host' | 'guest';
  color: 'w' | 'b';
  uid: string;
  displayName: string;
  rating?: number;
  mode?: 'friend' | 'ranked_arena';
  token?: string;
  onOpponentMove: (move: {
    from: string;
    to: string;
    promotion?: string;
    moveNumber: number;
    fenAfter: string;
    san?: string;
  }) => void;
  onMatchEnd: (result: {
    status: 'completed' | 'cancelled' | 'abandoned';
    reason: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'disconnect';
    winnerUid?: string | null;
    endedAt: number;
  }) => void;
  onOpponentPresence: (online: boolean) => void;
  onDrawOfferReceived: (received: boolean) => void;
  onDrawOfferSent: (sent: boolean) => void;
  onReady: () => void;
  onRankedResultVerified?: (result: { verificationHash: string, rankedMatchId: string }) => void;
  onRankedResultError?: (errorMsg: string) => void;
}

class RealtimeMultiplayerAdapter {
  private transport: RealtimeTransport = 'firestore';
  private config: AdapterConfig | null = null;
  private currentAppliedMoveNumber = 0;
  private isMatchActive = false;

  // Firestore specific variables
  private firestoreUnsubs: (() => void)[] = [];
  private presenceHeartbeat: any = null;
  private currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  public async initFriendMatch(config: AdapterConfig) {
    if (!isMultiplayerEnabled()) {
      console.warn('[Adapter] Multiplayer is disabled for v1.0. Returning early.');
      return;
    }

    this.currentFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    this.config = config;
    this.currentAppliedMoveNumber = 0;
    this.isMatchActive = false;
    this.firestoreUnsubs = [];

    if (!isRustRealtimeEnabled()) {
      console.log('[Adapter] Rust realtime disabled via environment. Initializing Firestore.');
      this.initFirestore();
      return;
    }

    // Try health check
    const httpUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_HTTP_URL) || 'http://localhost:3001';
    let isHealthy = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1500ms timeout
      const res = await fetch(`${httpUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'ok') {
          isHealthy = true;
        }
      }
    } catch (err) {
      console.warn('[Adapter] Rust health check failed, falling back to Firestore:', err);
    }

    setRustHealth(isHealthy ? 'healthy' : 'failed');

    if (!isHealthy) {
      this.initFirestore();
      return;
    }

    // Fetch fresh session token if authenticated
    if (auth?.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch(getApiUrl('/api/auth/session-token'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, sessionId: currentSessionId })
        });
        if (res.ok) {
          const data = await res.json();
          config.token = data.token;
        }
      } catch (tokenErr) {
        console.warn('[Adapter] Failed to fetch backend session token:', tokenErr);
      }
    } else {
      // Guest session token generation
      try {
        let guestUid = typeof localStorage !== 'undefined' ? localStorage.getItem('deviceId') : null;
        if (!guestUid) {
          guestUid = 'temp_' + Math.random().toString(36).substring(7);
        }
        const res = await fetch(getApiUrl('/api/auth/session-token'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest: true, guestUid, sessionId: currentSessionId })
        });
        if (res.ok) {
          const data = await res.json();
          config.token = data.token;
        }
      } catch (guestErr) {
        console.warn('[Adapter] Failed to fetch guest session token:', guestErr);
      }
    }

    // Try starting Rust WS
    try {
      rustRoomBridge.initRustFriendRoom(
        {
          roomId: config.roomId,
          role: config.role,
          color: config.color,
          uid: config.uid,
          displayName: config.displayName,
          rating: config.rating,
          mode: config.mode,
          token: config.token,
        },
        {
          onReady: () => {
            console.log('[Adapter] Rust room active. Transport set to rust_ws.');
            this.transport = 'rust_ws';
            this.isMatchActive = true;
            config.onReady();
          },
          onError: (code, message) => {
            console.warn(`[Adapter] Rust connection error: ${code} - ${message}`);
            // Fallback to Firestore only if match is not yet active
            if (!this.isMatchActive) {
              console.log('[Adapter] Fallback allowed. Initializing Firestore.');
              rustRoomBridge.closeRustRoom();
              this.initFirestore();
            } else {
              console.error('[Adapter] Cannot fallback mid-match. Reconnection attempt will run.');
            }
          },
          onPresence: (online) => {
            config.onOpponentPresence(online);
          },
        }
      );

      // Listen to Rust WS messages
      rustRoomBridge.listenRustOpponentMoves((oppMove) => {
        if (oppMove.moveNumber <= this.currentAppliedMoveNumber) {
          console.warn(`[Adapter] Duplicate opponent move ignored: ${oppMove.moveNumber}`);
          return;
        }
        this.currentAppliedMoveNumber = oppMove.moveNumber;
        this.currentFen = oppMove.fenAfter;
        config.onOpponentMove(oppMove);
      });

      rustRoomBridge.listenRustMatchEnd((endPayload) => {
        const status: 'completed' | 'cancelled' | 'abandoned' = endPayload.result === 'abandoned' ? 'abandoned' : 'completed';
        let reason: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'disconnect' = 'draw';
        if (endPayload.reason === 'player_resigned') {
          reason = 'resign';
        } else if (endPayload.reason === 'checkmate') {
          reason = 'checkmate';
        } else if (endPayload.reason === 'timeout') {
          reason = 'timeout';
        } else if (endPayload.reason === 'disconnect') {
          reason = 'disconnect';
        }

        const resultObj = {
          status,
          reason,
          winnerUid: endPayload.winnerUid || null,
          endedAt: Date.now(),
        };

        // Write final result to Firestore only
        submitFirestoreResult(config.roomId, resultObj).catch((err) => {
          console.warn('[Adapter] Failed to sync final result to Firestore:', err);
        });

        config.onMatchEnd(resultObj);
      });

      rustRoomBridge.listenRustDrawOffer((offered) => {
        config.onDrawOfferReceived(offered);
      });

      rustRoomBridge.listenRustDrawDeclined(() => {
        config.onDrawOfferReceived(false);
        config.onDrawOfferSent(false);
      });

      rustRoomBridge.listenRustRankedResultVerified((result) => {
        if (config.onRankedResultVerified) {
          config.onRankedResultVerified(result);
        }
      });

      rustRoomBridge.listenRustRankedResultError((errorMsg) => {
        if (config.onRankedResultError) {
          config.onRankedResultError(errorMsg);
        }
      });

    } catch (err) {
      console.error('[Adapter] Failed to init Rust WS, falling back to Firestore:', err);
      this.initFirestore();
    }
  }

  private initFirestore() {
    this.transport = 'firestore';
    this.isMatchActive = true;
    const config = this.config!;

    console.log('[Adapter] Initializing Firestore multiplayer listeners...');

    // 1. Mark player online
    setPlayerOnline(config.roomId, config.uid).catch(console.error);

    // 2. Start heartbeat
    this.presenceHeartbeat = setInterval(() => {
      updateLastSeen(config.roomId, config.uid).catch(console.error);
    }, 10000);

    // 3. Subscribe to moves
    const unsubMoves = subscribeToFirestoreMoves(config.roomId, (moves) => {
      if (moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        if (lastMove.playerUid !== config.uid) {
          if (lastMove.moveNumber <= this.currentAppliedMoveNumber) {
            return;
          }
          this.currentAppliedMoveNumber = lastMove.moveNumber;
          this.currentFen = lastMove.fenAfter;
          config.onOpponentMove({
            from: lastMove.from,
            to: lastMove.to,
            promotion: lastMove.promotion || undefined,
            moveNumber: lastMove.moveNumber,
            fenAfter: lastMove.fenAfter,
            san: lastMove.san || undefined,
          });
        }
      }
    });
    this.firestoreUnsubs.push(unsubMoves);

    // 4. Subscribe to result
    const unsubResult = subscribeToFirestoreResult(config.roomId, (result) => {
      if (result) {
        config.onMatchEnd({
          status: result.status,
          reason: result.reason,
          winnerUid: result.winnerUid,
          endedAt: result.endedAt,
        });
      }
    });
    this.firestoreUnsubs.push(unsubResult);

    // 5. Subscribe to presence
    const unsubPresence = subscribeToPresence(config.roomId, (presenceList) => {
      const oppUid = config.role === 'host' ? 'guest' : 'host'; // Fallback mapping checks
      // We will look for an online user who is not ourselves
      const opponent = presenceList.find((p) => p.uid !== config.uid);
      if (opponent) {
        config.onOpponentPresence(opponent.online);
      }
    });
    this.firestoreUnsubs.push(unsubPresence);

    // 6. Subscribe to draw offers
    const unsubDraw = subscribeToFirestoreDrawOffers(config.roomId, (activeOffer) => {
      if (activeOffer) {
        if (activeOffer.fromUid !== config.uid) {
          config.onDrawOfferReceived(true);
        } else {
          config.onDrawOfferSent(true);
        }
      } else {
        config.onDrawOfferReceived(false);
        config.onDrawOfferSent(false);
      }
    });
    this.firestoreUnsubs.push(unsubDraw);

    // Call ready
    config.onReady();
  }

  public async submitMove(move: {
    from: string;
    to: string;
    promotion?: string;
    moveNumber: number;
    fenAfter: string;
    san?: string;
  }) {
    if (!this.config) return;

    const clientFenBefore = this.currentFen;
    this.currentAppliedMoveNumber = move.moveNumber;
    this.currentFen = move.fenAfter;

    if (this.transport === 'rust_ws') {
      const moveUci = move.from + move.to + (move.promotion ? move.promotion.toLowerCase() : "");
      rustRoomBridge.submitRustMove({
        matchId: this.config.roomId,
        sessionId: currentSessionId,
        moveUci,
        clientMoveNumber: move.moveNumber,
        clientFenBefore,
        timestamp: Date.now(),
      });
    } else {
      await submitFirestoreMove(this.config.roomId, {
        roomId: this.config.roomId,
        moveNumber: move.moveNumber,
        from: move.from,
        to: move.to,
        promotion: move.promotion || '',
        color: this.config.color,
        playerUid: this.config.uid,
        fenAfter: move.fenAfter,
        san: move.san || '',
      });
      const nextTurn = this.config.color === 'w' ? 'b' : 'w';
      await updateFirestoreRoomFen(this.config.roomId, move.fenAfter, nextTurn, move.moveNumber);
    }
  }

  public async offerDraw() {
    if (!this.config) return;

    if (this.transport === 'rust_ws') {
      rustRoomBridge.offerRustDraw();
      this.config.onDrawOfferSent(true);
    } else {
      const oppUid = this.config.role === 'host' ? 'guest' : 'host'; // Simple placeholder checking
      // In Firestore, we must retrieve opponentUid. Let's obtain it or fall back
      const activeOffer = await getActiveFirestoreDrawOffer(this.config.roomId);
      if (!activeOffer) {
        await createFirestoreDrawOffer(this.config.roomId, this.config.uid, oppUid);
      }
    }
  }

  public async respondDraw(accepted: boolean) {
    if (!this.config) return;

    if (this.transport === 'rust_ws') {
      rustRoomBridge.respondRustDraw(accepted);
    } else {
      const activeOffer = await getActiveFirestoreDrawOffer(this.config.roomId);
      if (activeOffer) {
        if (accepted) {
          await acceptFirestoreDrawOffer(this.config.roomId, activeOffer.offerId, this.config.uid);
        } else {
          await declineFirestoreDrawOffer(this.config.roomId, activeOffer.offerId, this.config.uid);
        }
      }
    }
  }

  public async resign() {
    if (!this.config) return;

    if (this.transport === 'rust_ws') {
      rustRoomBridge.resignRustRoom();
    } else {
      await submitFirestoreResult(this.config.roomId, {
        status: 'completed',
        reason: 'resign',
        winnerUid: this.config.role === 'host' ? 'guest' : this.config.uid, // Resigned so opponent wins
        winnerColor: this.config.color === 'w' ? 'b' : 'w',
        endedAt: Date.now(),
      });
    }
  }

  public async submitResult(result: any) {
    if (!this.config) return;
    await submitFirestoreResult(this.config.roomId, result);
  }

  public async submitRankedResult(result: string, reason: string) {
    if (!this.config) return;

    if (!isMultiplayerEnabled()) {
      console.warn('[Adapter] Multiplayer is disabled for v1.0. Ignoring submitRankedResult.');
      return;
    }

    if (this.transport === 'rust_ws') {
      rustRoomBridge.submitRustRankedResult(result, reason);
    } else {
      console.warn('[Adapter] Ranked results are only supported over Rust WS');
    }
  }

  public getTransport(): RealtimeTransport {
    return this.transport;
  }

  public dispose() {
    if (this.transport === 'rust_ws') {
      rustRoomBridge.closeRustRoom();
    } else {
      if (this.config) {
        setPlayerOffline(this.config.roomId, this.config.uid).catch(console.error);
      }
      this.firestoreUnsubs.forEach((unsub) => {
        try {
          unsub();
        } catch (e) {
          console.error('[Adapter] Unsub error:', e);
        }
      });
      this.firestoreUnsubs = [];

      if (this.presenceHeartbeat) {
        clearInterval(this.presenceHeartbeat);
        this.presenceHeartbeat = null;
      }
    }

    this.config = null;
    this.isMatchActive = false;
  }
}

export const realtimeMultiplayerAdapter = new RealtimeMultiplayerAdapter();
