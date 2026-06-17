import { MultiplayerRoom, RoomStatus } from './multiplayerTypes';
import { ChessLogic } from '../../lib/chess-logic';

export function validatePlayerInRoom(room: MultiplayerRoom, uid: string): boolean {
  if (!uid) return false;
  return room.hostUid === uid || room.guestUid === uid;
}

export function validateTurn(room: MultiplayerRoom, uid: string, color: 'w' | 'b'): boolean {
  if (!uid || !color) return false;
  
  // Host must be White ('w') and Guest must be Black ('b')
  const assignedColor = uid === room.hostUid ? 'w' : (uid === room.guestUid ? 'b' : null);
  
  if (assignedColor !== color) {
    return false;
  }

  return room.currentTurn === color;
}

export function validateMoveNumber(room: MultiplayerRoom, moveNumber: number): boolean {
  return moveNumber === room.moveCount + 1;
}

export function validateRoomStatus(room: MultiplayerRoom, expectedStatus: RoomStatus): boolean {
  return room.status === expectedStatus;
}

export function validateRoomStatusTransition(currentStatus: RoomStatus, nextStatus: RoomStatus): boolean {
  // Strict transition table:
  // waiting -> ready
  // ready -> active
  // active -> completed
  // active -> abandoned
  // waiting -> cancelled
  // ready -> cancelled
  
  switch (currentStatus) {
    case 'waiting':
      return nextStatus === 'ready' || nextStatus === 'cancelled';
    case 'ready':
      return nextStatus === 'active' || nextStatus === 'cancelled';
    case 'active':
      return nextStatus === 'completed' || nextStatus === 'abandoned';
    case 'completed':
    case 'cancelled':
    case 'abandoned':
      return false; // Terminal states cannot transition
    default:
      return false;
  }
}

export function validateLegalMove(boardStateFen: string, move: { from: string; to: string; promotion?: string }): boolean {
  try {
    const chess = new ChessLogic(boardStateFen);
    // makeMove returns a Move object on success, or null/throws on failure
    const result = chess.makeMove(move);
    return result !== null;
  } catch (e) {
    return false;
  }
}
