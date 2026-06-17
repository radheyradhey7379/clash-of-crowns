import { MultiplayerInvitePayload } from './multiplayerTypes';

export function createInvitePayload(roomId: string, hostUid: string): string {
  const payload: MultiplayerInvitePayload = {
    type: 'multiplayer_invite',
    roomId,
    hostUid,
    createdAt: Date.now()
  };
  return JSON.stringify(payload);
}

export function parseInvitePayload(payloadStr: string): MultiplayerInvitePayload | null {
  try {
    const parsed = JSON.parse(payloadStr);
    if (parsed && typeof parsed === 'object') {
      return parsed as MultiplayerInvitePayload;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function validateInvitePayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  
  if (payload.type !== 'multiplayer_invite') {
    return false;
  }
  
  if (typeof payload.roomId !== 'string' || !payload.roomId.trim()) {
    return false;
  }
  
  if (typeof payload.hostUid !== 'string' || !payload.hostUid.trim()) {
    return false;
  }
  
  if (typeof payload.createdAt !== 'number') {
    return false;
  }

  // Check if payload is less than 5 minutes old
  const ageMs = Date.now() - payload.createdAt;
  if (ageMs < 0 || ageMs > 5 * 60 * 1000) {
    return false;
  }
  
  return true;
}
