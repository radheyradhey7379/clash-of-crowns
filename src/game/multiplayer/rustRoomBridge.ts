import { realtimeClient } from '../../services/realtime/realtimeClient';
import {
  ServerMessage,
  RealtimeConnectionStatus,
  RealtimeMovePayload,
  RealtimeOpponentMovePayload,
  RealtimeMatchEndPayload,
} from './realtimeModeTypes';

export interface RustRoomConfig {
  roomId: string;
  role: 'host' | 'guest';
  color: 'w' | 'b';
  uid: string;
  displayName: string;
  rating?: number;
  mode?: 'friend' | 'ranked_arena';
  token?: string;
}

class RustRoomBridge {
  private config: RustRoomConfig | null = null;
  private opponentMoveCallback: ((move: RealtimeOpponentMovePayload) => void) | null = null;
  private matchEndCallback: ((payload: RealtimeMatchEndPayload) => void) | null = null;
  private drawOfferCallback: ((offered: boolean) => void) | null = null;
  private drawDeclinedCallback: (() => void) | null = null;
  private presenceCallback: ((online: boolean) => void) | null = null;
  private onReadyCallback: (() => void) | null = null;
  private onErrorCallback: ((code: string, message: string) => void) | null = null;
  private rankedResultVerifiedCallback: ((result: { verificationHash: string, rankedMatchId: string }) => void) | null = null;
  private rankedResultErrorCallback: ((errorMsg: string) => void) | null = null;

  private isReady = false;

  public initRustFriendRoom(
    config: RustRoomConfig,
    callbacks: {
      onReady: () => void;
      onError: (code: string, message: string) => void;
      onPresence: (online: boolean) => void;
    }
  ) {
    this.config = config;
    this.onReadyCallback = callbacks.onReady;
    this.onErrorCallback = callbacks.onError;
    this.presenceCallback = callbacks.onPresence;
    this.isReady = false;

    // Set active room ID on client for heartbeats
    realtimeClient.setActiveRoom(config.roomId);

    // Setup message and status handlers
    realtimeClient.onRealtimeMessage(this.handleServerMessage.bind(this));
    realtimeClient.onRealtimeStatus(this.handleStatusChange.bind(this));

    // Resolve URL from environment
    const url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_WS_URL) || 'ws://localhost:3001/ws';
    
    // Connect to WebSocket server
    realtimeClient.connectRealtime(url, {
      uid: config.uid,
      displayName: config.displayName,
      rating: config.rating,
      token: config.token,
    });
  }

  public submitRustMove(move: Omit<RealtimeMovePayload, 'roomId' | 'playerUid'>) {
    if (!this.config) return;
    realtimeClient.submitRealtimeMove({
      ...move,
      roomId: this.config.roomId,
      playerUid: this.config.uid,
    });
  }

  public listenRustOpponentMoves(callback: (move: RealtimeOpponentMovePayload) => void) {
    this.opponentMoveCallback = callback;
  }

  public listenRustMatchEnd(callback: (payload: RealtimeMatchEndPayload) => void) {
    this.matchEndCallback = callback;
  }

  public listenRustDrawOffer(callback: (offered: boolean) => void) {
    this.drawOfferCallback = callback;
  }

  public listenRustDrawDeclined(callback: () => void) {
    this.drawDeclinedCallback = callback;
  }

  public listenRustRankedResultVerified(callback: (result: { verificationHash: string, rankedMatchId: string }) => void) {
    this.rankedResultVerifiedCallback = callback;
  }

  public listenRustRankedResultError(callback: (errorMsg: string) => void) {
    this.rankedResultErrorCallback = callback;
  }

  public offerRustDraw() {
    if (!this.config) return;
    realtimeClient.offerRealtimeDraw(this.config.roomId);
  }

  public respondRustDraw(accepted: boolean) {
    if (!this.config) return;
    realtimeClient.respondRealtimeDraw(this.config.roomId, accepted);
  }

  public resignRustRoom() {
    if (!this.config) return;
    realtimeClient.resignRealtimeRoom(this.config.roomId);
  }

  public submitRustRankedResult(result: string, reason: string) {
    if (!this.config) return;
    realtimeClient.submitRealtimeResult(this.config.roomId, result, reason);
  }

  public closeRustRoom() {
    realtimeClient.setActiveRoom(null);
    realtimeClient.disconnectRealtime();
    
    // Clear callbacks and status
    this.config = null;
    this.opponentMoveCallback = null;
    this.matchEndCallback = null;
    this.drawOfferCallback = null;
    this.drawDeclinedCallback = null;
    this.presenceCallback = null;
    this.onReadyCallback = null;
    this.onErrorCallback = null;
    this.rankedResultVerifiedCallback = null;
    this.rankedResultErrorCallback = null;
    this.isReady = false;
  }

  private handleServerMessage(msg: ServerMessage) {
    if (!this.config) return;

    switch (msg.type) {
      case 'auth_ok':
        // Connected & authenticated, join or create the room
        if (this.config.role === 'host') {
          realtimeClient.createRealtimeRoom(this.config.roomId, this.config.mode || 'friend');
        } else {
          realtimeClient.joinRealtimeRoom(this.config.roomId);
        }
        break;

      case 'room_created':
      case 'room_joined':
        // Once joined, send player_ready immediately
        realtimeClient.sendPlayerReady(this.config.roomId);
        break;

      case 'room_state':
        // If room status is active, trigger the ready callback
        if (msg.status === 'active' && !this.isReady) {
          this.isReady = true;
          if (this.onReadyCallback) {
            this.onReadyCallback();
          }
        }
        break;

      case 'opponent_move':
        if (this.opponentMoveCallback) {
          this.opponentMoveCallback({
            roomId: msg.room_id,
            moveNumber: msg.move_number,
            from: msg.from,
            to: msg.to,
            promotion: msg.promotion || undefined,
            fenAfter: msg.fen_after,
            san: msg.san || undefined,
          });
        }
        break;

      case 'match_ended':
        if (this.matchEndCallback) {
          this.matchEndCallback({
            roomId: msg.room_id,
            result: msg.result,
            reason: msg.reason,
            winnerUid: msg.winner_uid,
          });
        }
        break;

      case 'opponent_disconnected':
        if (this.presenceCallback) {
          this.presenceCallback(false);
        }
        break;

      case 'opponent_reconnected':
        if (this.presenceCallback) {
          this.presenceCallback(true);
        }
        break;

      case 'error':
        if (msg.code === 'draw_offered') {
          if (this.drawOfferCallback) {
            this.drawOfferCallback(true);
          }
        } else if (msg.code === 'draw_declined') {
          if (this.drawDeclinedCallback) {
            this.drawDeclinedCallback();
          }
        } else if (msg.code === 'protocol_version_mismatch' || msg.code === 'auth_failed') {
          if (this.onErrorCallback) {
            this.onErrorCallback(msg.code, msg.message);
          }
        } else {
          console.warn('[RustRoomBridge] Server error:', msg.message);
        }
        break;

      case 'verified_result':
        if (this.rankedResultVerifiedCallback) {
          this.rankedResultVerifiedCallback({
            verificationHash: msg.verification_hash,
            rankedMatchId: msg.ranked_match_id,
          });
        }
        break;

      case 'result_error':
        if (this.rankedResultErrorCallback) {
          this.rankedResultErrorCallback(msg.error_msg);
        }
        break;

      default:
        break;
    }
  }

  private handleStatusChange(status: RealtimeConnectionStatus) {
    if (!this.config) return;

    if (status === 'failed' || status === 'closed') {
      // If we haven't successfully connected and readied yet, report it as an error to allow fallback
      if (!this.isReady && this.onErrorCallback) {
        this.onErrorCallback('connection_failed', 'WebSocket connection failed');
      }
    }
    
    // Auto-rejoin on reconnect
    if (status === 'connected' && this.isReady) {
      realtimeClient.joinRealtimeRoom(this.config.roomId);
    }
  }
}

export const rustRoomBridge = new RustRoomBridge();
