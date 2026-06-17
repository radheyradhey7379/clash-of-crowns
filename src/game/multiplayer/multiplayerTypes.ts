export type RoomStatus = 'waiting' | 'ready' | 'active' | 'completed' | 'cancelled' | 'abandoned';

export interface MultiplayerRoom {
  roomId: string;
  hostUid: string;
  hostName: string;
  guestUid?: string;
  guestName?: string;
  status: RoomStatus;
  fen: string;
  currentTurn: 'w' | 'b';
  moveCount: number;
  createdAt: number;
  updatedAt: number;
  result?: MultiplayerResult | null;
  hostColor?: 'w' | 'b';
  guestColor?: 'w' | 'b';
  mode?: 'friend' | 'ranked';
  source?: 'standard' | 'challenge';
  challengeRequestId?: string;
}

export interface MultiplayerMove {
  moveId: string;
  roomId: string;
  moveNumber: number;
  from: string;
  to: string;
  promotion?: string;
  color: 'w' | 'b';
  playerUid: string;
  fenAfter: string;
  san?: string;
  createdAt: number;
}

export interface PlayerPresence {
  uid: string;
  online: boolean;
  lastSeen: number;
}

export interface MultiplayerInvitePayload {
  type: 'multiplayer_invite';
  roomId: string;
  hostUid: string;
  createdAt: number;
}

export type ResultType = 'completed' | 'cancelled' | 'abandoned';
export type ResultReason = 'checkmate' | 'resign' | 'timeout' | 'draw' | 'disconnect';

export interface MultiplayerResult {
  winnerUid?: string | null;
  winnerColor?: 'w' | 'b' | null;
  status: ResultType;
  reason: ResultReason;
  endedAt: number;
}

export interface DrawOffer {
  offerId: string;
  roomId: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface MultiplayerHistoryItem {
  roomId: string;
  opponentUid: string;
  opponentName: string;
  result: 'win' | 'loss' | 'draw' | 'abandoned';
  reason: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'disconnect';
  playedAt: number;
  moves: number;
}
