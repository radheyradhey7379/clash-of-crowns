import { ServerMessage, RealtimeConnectionStatus, RealtimeMovePayload } from '../../game/multiplayer/realtimeModeTypes';

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private reconnectTimeout: any = null;
  private activeRoomId: string | null = null;
  private isConnecting = false;
  private status: RealtimeConnectionStatus = 'idle';

  public url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_WS_URL) || 'ws://localhost:3001/ws';
  public connected = false;
  public authenticated = false;
  public fallbackToFirestore = true;

  public onOpenCallback: (() => void) | null = null;
  public onCloseCallback: (() => void) | null = null;
  public onMessageCallback: ((msg: ServerMessage) => void) | null = null;
  public onErrorCallback: ((err: any) => void) | null = null;
  public onStatusCallback: ((status: RealtimeConnectionStatus) => void) | null = null;
  public onLatencyCallback: ((rtt: number | null) => void) | null = null;

  private uid = '';
  private displayName = '';
  private token: string | null = null;
  private rating: number = 1200;
  private lastPingTime = 0;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      this.url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_REALTIME_WS_URL) || 'ws://localhost:3001/ws';
    }
  }

  private updateStatus(newStatus: RealtimeConnectionStatus) {
    this.status = newStatus;
    if (this.onStatusCallback) {
      try {
        this.onStatusCallback(newStatus);
      } catch (err) {
        console.error('[RealtimeClient] Error in status callback:', err);
      }
    }
  }

  public connect(uid: string, displayName: string) {
    if (this.socket || this.isConnecting) return;
    this.uid = uid;
    this.displayName = displayName;
    this.isConnecting = true;
    this.updateStatus('connecting');

    try {
      this.socket = new WebSocket(this.url);
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (err) {
      console.error('[RealtimeClient] Connection error:', err);
      this.isConnecting = false;
      this.updateStatus('failed');
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.isConnecting = false;
    this.updateStatus('closed');
    if (this.onLatencyCallback) {
      try {
        this.onLatencyCallback(null);
      } catch (err) {
        console.error('[RealtimeClient] Error in latency callback on disconnect:', err);
      }
    }
  }

  public sendMessage(msg: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeClient] Cannot send message, socket not open');
      return;
    }
    this.socket.send(JSON.stringify(msg));
  }

  private handleOpen() {
    console.log('[RealtimeClient] WebSocket connection opened. Authenticating...');
    this.connected = true;
    this.isConnecting = false;
    this.fallbackToFirestore = false;

    // Send Auth message as first message
    this.sendMessage({
      type: 'auth',
      uid: this.uid,
      display_name: this.displayName,
      token: this.token || null,
      rating: this.rating,
      protocol_version: '1.0.0',
    });

    if (this.onOpenCallback) {
      this.onOpenCallback();
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('[RealtimeClient] WebSocket connection closed:', event.reason);
    this.connected = false;
    this.authenticated = false;
    this.isConnecting = false;
    this.fallbackToFirestore = true;
    this.stopHeartbeat();
    
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
    
    if (this.onLatencyCallback) {
      try {
        this.onLatencyCallback(null);
      } catch (err) {
        console.error('[RealtimeClient] Error in latency callback on close:', err);
      }
    }
    
    this.updateStatus('reconnecting');
    this.scheduleReconnect();
  }

  private handleError(err: any) {
    console.error('[RealtimeClient] WebSocket error:', err);
    this.fallbackToFirestore = true;
    this.updateStatus('failed');
    if (this.onErrorCallback) {
      this.onErrorCallback(err);
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const msg: ServerMessage = JSON.parse(event.data);
      if (msg.type === 'auth_ok') {
        console.log('[RealtimeClient] Authentication successful.');
        this.authenticated = true;
        this.updateStatus('connected');
        this.startHeartbeat();
      }

      if (msg.type === 'pong') {
        if (this.lastPingTime > 0) {
          const rtt = Date.now() - this.lastPingTime;
          if (this.onLatencyCallback) {
            try {
              this.onLatencyCallback(rtt);
            } catch (err) {
              console.error('[RealtimeClient] Error in latency callback on pong:', err);
            }
          }
        }
      }

      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
    } catch (err) {
      console.error('[RealtimeClient] Failed to parse incoming message:', err);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.lastPingTime = Date.now();
      this.sendMessage({
        type: 'heartbeat',
        room_id: this.activeRoomId,
      });
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    console.log('[RealtimeClient] Scheduling reconnect in 5 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('[RealtimeClient] Reconnecting...');
      this.connect(this.uid, this.displayName);
    }, 5000);
  }

  public setActiveRoom(roomId: string | null) {
    this.activeRoomId = roomId;
  }

  // --- UPGRADED API METHODS FOR PHASE 26 ---

  public connectRealtime(url: string, authPayload: { uid: string; displayName: string; token?: string; rating?: number }) {
    this.url = url;
    this.uid = authPayload.uid;
    this.displayName = authPayload.displayName;
    this.token = authPayload.token || null;
    this.rating = authPayload.rating || 1200;
    this.connect(this.uid, this.displayName);
  }

  public disconnectRealtime() {
    this.disconnect();
  }

  public createRealtimeRoom(roomId?: string, mode: 'friend' | 'ranked_arena' = 'friend') {
    this.sendMessage({
      type: 'create_room',
      room_id: roomId || null,
      mode: mode,
    });
  }

  public joinRealtimeRoom(roomId: string) {
    this.sendMessage({
      type: 'join_room',
      room_id: roomId,
    });
  }

  public sendPlayerReady(roomId: string) {
    this.sendMessage({
      type: 'player_ready',
      room_id: roomId,
    });
  }

  public submitRealtimeMove(payload: {
    roomId: string;
    matchId: string;
    playerId: string;
    sessionId: string;
    moveUci: string;
    clientMoveNumber: number;
    clientFenBefore: string;
    timestamp: number;
  }) {
    this.sendMessage({
      type: 'submit_move',
      room_id: payload.roomId,
      match_id: payload.matchId,
      player_id: payload.playerId,
      session_id: payload.sessionId,
      move_uci: payload.moveUci,
      client_move_number: payload.clientMoveNumber,
      client_fen_before: payload.clientFenBefore,
      timestamp: payload.timestamp,
    });
  }

  public offerRealtimeDraw(roomId: string) {
    this.sendMessage({
      type: 'offer_draw',
      room_id: roomId,
    });
  }

  public respondRealtimeDraw(roomId: string, accepted: boolean) {
    this.sendMessage({
      type: 'respond_draw',
      room_id: roomId,
      accepted,
    });
  }

  public resignRealtimeRoom(roomId: string) {
    this.sendMessage({
      type: 'resign',
      room_id: roomId,
    });
  }

  public submitRealtimeResult(roomId: string, result: string, reason: string) {
    this.sendMessage({
      type: 'submit_result',
      room_id: roomId,
      result,
      reason,
    });
  }

  public onRealtimeMessage(callback: (msg: ServerMessage) => void) {
    this.onMessageCallback = callback;
  }

  public onRealtimeStatus(callback: (status: RealtimeConnectionStatus) => void) {
    this.onStatusCallback = callback;
  }

  public getRealtimeStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  public isRealtimeAvailable(): boolean {
    return this.connected && this.authenticated;
  }
}

export const realtimeClient = new RealtimeClient();
