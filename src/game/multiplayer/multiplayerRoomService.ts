import { db, doc, getDoc, setDoc, updateDoc } from '../../firebase';
import { MultiplayerRoom, RoomStatus, MultiplayerResult } from './multiplayerTypes';
import { isMultiplayerEnabled } from '../../lib/config/featureFlags';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like I, O, 1, 0
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function createFriendRoom(hostUid: string, hostName: string, options?: any): Promise<MultiplayerRoom> {
  if (!isMultiplayerEnabled()) {
    throw new Error('feature_disabled');
  }

  if (!hostUid) {
    throw new Error('Host UID is required to create a room.');
  }

  const roomId = generateRoomId();
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);

  const room: MultiplayerRoom = {
    roomId,
    hostUid,
    hostName,
    status: 'waiting',
    fen: STARTING_FEN,
    currentTurn: 'w',
    moveCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    result: null,
  };

  await setDoc(roomDocRef, room);
  return room;
}

export async function getRoom(roomId: string): Promise<MultiplayerRoom | null> {
  if (!roomId) return null;
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const snap = await getDoc(roomDocRef);
  if (snap.exists()) {
    return snap.data() as MultiplayerRoom;
  }
  return null;
}

export async function joinRoom(roomId: string, guestUid: string, guestName: string): Promise<MultiplayerRoom> {
  if (!isMultiplayerEnabled()) {
    throw new Error('feature_disabled');
  }

  if (!roomId || !guestUid) {
    throw new Error('Room ID and Guest UID are required.');
  }

  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const snap = await getDoc(roomDocRef);

  if (!snap.exists()) {
    throw new Error('Room ID not found. Please verify the code.');
  }

  const room = snap.data() as MultiplayerRoom;

  if (!room.hostUid) {
    throw new Error('Host is missing in this room.');
  }

  // Room is full if guestUid exists and is not the current user
  if (room.guestUid && room.guestUid !== guestUid) {
    throw new Error('Room is already full.');
  }

  if (room.status === 'active') {
    throw new Error('Match is already active.');
  }

  if (room.status === 'completed') {
    throw new Error('Match is already completed.');
  }

  if (room.status === 'cancelled') {
    throw new Error('Room has been cancelled.');
  }

  if (room.status === 'abandoned') {
    throw new Error('Match has been abandoned.');
  }

  if (room.status === 'ready' && room.guestUid !== guestUid) {
    throw new Error('Room is already full.');
  }

  const updates = {
    guestUid,
    guestName,
    status: 'ready' as RoomStatus,
    updatedAt: Date.now(),
  };

  await updateDoc(roomDocRef, updates);
  return { ...room, ...updates };
}

export async function cancelRoom(roomId: string): Promise<void> {
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const snap = await getDoc(roomDocRef);
  if (!snap.exists()) throw new Error('Room not found.');

  const room = snap.data() as MultiplayerRoom;
  if (room.status !== 'waiting' && room.status !== 'ready') {
    throw new Error(`Cannot cancel room in ${room.status} status.`);
  }

  await updateDoc(roomDocRef, {
    status: 'cancelled' as RoomStatus,
    updatedAt: Date.now(),
  });
}

export async function markRoomActive(roomId: string): Promise<void> {
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const snap = await getDoc(roomDocRef);
  if (!snap.exists()) throw new Error('Room not found.');

  const room = snap.data() as MultiplayerRoom;
  if (room.status !== 'ready') {
    throw new Error(`Cannot activate room from status ${room.status}.`);
  }

  await updateDoc(roomDocRef, {
    status: 'active' as RoomStatus,
    updatedAt: Date.now(),
  });
}

export async function updateRoomFen(roomId: string, fen: string, currentTurn: 'w' | 'b', moveCount: number): Promise<void> {
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  await updateDoc(roomDocRef, {
    fen,
    currentTurn,
    moveCount,
    updatedAt: Date.now(),
  });
}

export async function completeRoom(roomId: string, result: MultiplayerResult): Promise<void> {
  const roomDocRef = doc(db, 'multiplayerRooms', roomId);
  const snap = await getDoc(roomDocRef);
  if (!snap.exists()) throw new Error('Room not found.');

  const room = snap.data() as MultiplayerRoom;
  
  // Enforce status transitions: only active can go to completed or abandoned, waiting/ready to cancelled
  // Wait, check transition correctness
  const isAllowed = 
    (room.status === 'active' && (result.status === 'completed' || result.status === 'abandoned')) ||
    ((room.status === 'waiting' || room.status === 'ready') && result.status === 'cancelled');

  if (!isAllowed) {
    throw new Error(`Invalid status transition from ${room.status} to ${result.status}.`);
  }

  await updateDoc(roomDocRef, {
    status: result.status as RoomStatus,
    result,
    updatedAt: Date.now(),
  });
}
