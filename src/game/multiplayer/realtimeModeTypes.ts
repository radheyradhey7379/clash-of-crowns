export type RealtimeTransport = 'rust_ws' | 'firestore';

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'closed';

export interface MultiplayerRuntimeMode {
  transport: RealtimeTransport;
  status: RealtimeConnectionStatus;
}

export interface RealtimeMovePayload {
  roomId: string;
  moveNumber: number;
  from: string;
  to: string;
  promotion?: string;
  color: 'w' | 'b';
  playerUid: string;
  fenAfter: string;
  san?: string;
  clientMessageId?: string;
}

export interface RealtimeOpponentMovePayload {
  roomId: string;
  moveNumber: number;
  from: string;
  to: string;
  promotion?: string;
  fenAfter: string;
  san?: string;
}

export interface RealtimeMatchEndPayload {
  roomId: string;
  result: string; // 'draw' | 'resign' | 'abandoned' | 'checkmate' etc.
  reason: string;
  winnerUid?: string | null;
}

export type ServerMessage =
  | { type: 'auth_ok'; uid: string }
  | { type: 'error'; code: string; message: string; client_message_id?: string | null }
  | { type: 'room_created'; room_id: string }
  | { type: 'room_joined'; room_id: string; color: string }
  | {
      type: 'room_state';
      room_id: string;
      status: string;
      fen: string;
      current_turn: string;
      move_count: number;
      white_uid?: string | null;
      black_uid?: string | null;
    }
  | {
      type: 'move_accepted';
      room_id: string;
      move_number: number;
      fen_after: string;
      current_turn: string;
      client_message_id?: string | null;
    }
  | {
      type: 'opponent_move';
      room_id: string;
      move_number: number;
      from: string;
      to: string;
      promotion?: string | null;
      fen_after: string;
      san?: string | null;
    }
  | { type: 'opponent_disconnected'; room_id: string; reconnect_seconds: number }
  | { type: 'opponent_reconnected'; room_id: string }
  | {
      type: 'match_ended';
      room_id: string;
      result: string;
      reason: string;
      winner_uid?: string | null;
    }
  | { type: 'pong'; server_time: number }
  | {
      type: 'verified_result';
      room_id: string;
      verification_hash: string;
      ranked_match_id: string;
      white_uid: string;
      black_uid: string;
      result: string;
      reason: string;
      move_count: number;
    }
  | {
      type: 'result_error';
      room_id: string;
      error_msg: string;
    };
