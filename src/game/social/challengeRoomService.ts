import { db, doc, getDoc, runTransaction } from '../../firebase';
import { ChallengeRequest } from './challengeTypes';
import { MultiplayerRoom } from '../multiplayer/multiplayerTypes';
import { createRoomReadyNotifications } from './notificationService';
import { updateChallengeInboxOnAccept } from './chatInboxService';
import { isChallengeMatchEnabled } from '../../lib/config/featureFlags';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Accepts a challenge request and creates a Friend Match room in a single transaction.
 * Blocks room creation for 'poke' type (only updates status to accepted).
 */
export async function acceptChallengeAndCreateRoom(
  challengeId: string,
  receiverUid: string
): Promise<{ success: boolean; reason?: string; roomId?: string }> {
  if (!isChallengeMatchEnabled()) {
    return { success: false, reason: 'feature_disabled' };
  }

  try {
    const challengeRef = doc(db, 'challengeRequests', challengeId);

    const result = await runTransaction(db, async (transaction) => {
      const challengeSnap = await transaction.get(challengeRef);
      if (!challengeSnap.exists()) {
        throw new Error('Challenge does not exist');
      }

      const challenge = challengeSnap.data() as ChallengeRequest;

      // If already accepted and roomId exists, return existing roomId
      if (challenge.status === 'accepted' && challenge.roomId) {
        return { success: true, roomId: challenge.roomId, challenge };
      }

      // Validations
      if (receiverUid !== challenge.toUid) {
        throw new Error('You are not the receiver of this challenge');
      }

      if (challenge.status !== 'pending' && challenge.status !== 'seen') {
        throw new Error(`Challenge is already in state: ${challenge.status}`);
      }

      if (challenge.expiresAt < Date.now()) {
        throw new Error('Challenge has expired');
      }

      // If type is poke, update challenge but do not create room
      if (challenge.type === 'poke') {
        const updatedChallenge = {
          ...challenge,
          status: 'accepted' as const,
          acceptedAt: Date.now()
        };
        transaction.update(challengeRef, {
          status: 'accepted',
          acceptedAt: Date.now()
        });
        return { success: true, challenge: updatedChallenge };
      }

      // If type is challenge, create the room deterministically
      const roomId = 'CH-' + challengeId.slice(0, 8);
      const roomRef = doc(db, 'multiplayerRooms', roomId);
      
      const roomSnap = await transaction.get(roomRef);
      // If room already exists, we do not overwrite it
      if (!roomSnap.exists()) {
        const room: MultiplayerRoom = {
          roomId,
          hostUid: challenge.fromUid,
          hostName: challenge.fromName,
          guestUid: challenge.toUid,
          guestName: challenge.toName || 'Challenger',
          status: 'ready',
          fen: STARTING_FEN,
          currentTurn: 'w',
          moveCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          result: null,
          hostColor: 'w',
          guestColor: 'b',
          mode: 'friend',
          source: 'challenge',
          challengeRequestId: challengeId
        };
        transaction.set(roomRef, room);
      }

      const updatedChallenge = {
        ...challenge,
        status: 'accepted' as const,
        roomId,
        roomStatus: 'created' as const,
        acceptedAt: Date.now()
      };

      transaction.update(challengeRef, {
        status: 'accepted',
        roomId,
        roomStatus: 'created',
        acceptedAt: Date.now()
      });

      return { success: true, roomId, challenge: updatedChallenge };
    });

    if (result.success && result.roomId && result.challenge) {
      // Trigger post-transaction notifications & chat inbox updates non-blockingly
      try {
        await createRoomReadyNotifications(result.challenge, result.roomId);
      } catch (err) {
        console.warn('[challengeRoomService] Post-transaction notifications failed:', err);
      }

      try {
        await updateChallengeInboxOnAccept(result.challenge, result.roomId);
      } catch (err) {
        console.warn('[challengeRoomService] Post-transaction chat updates failed:', err);
      }
    }

    return { success: true, roomId: result.roomId };
  } catch (err: any) {
    console.error('[challengeRoomService] acceptChallengeAndCreateRoom failed:', err);
    return { success: false, reason: err.message || 'Failed to accept challenge' };
  }
}

/**
 * Fetches the room associated with the challenge request.
 */
export async function getChallengeRoom(challengeId: string): Promise<MultiplayerRoom | null> {
  try {
    const challengeSnap = await getDoc(doc(db, 'challengeRequests', challengeId));
    if (!challengeSnap.exists()) return null;
    const challenge = challengeSnap.data() as ChallengeRequest;
    if (!challenge.roomId) return null;
    
    const roomSnap = await getDoc(doc(db, 'multiplayerRooms', challenge.roomId));
    if (roomSnap.exists()) {
      return roomSnap.data() as MultiplayerRoom;
    }
    return null;
  } catch (err) {
    console.error('[challengeRoomService] getChallengeRoom failed:', err);
    return null;
  }
}

/**
 * Validates the challenge and room, returning navigation credentials.
 */
export async function enterChallengeRoom(
  challengeId: string,
  uid: string
): Promise<{ roomId: string; role: 'host' | 'guest'; color: 'w' | 'b' } | null> {
  if (!isChallengeMatchEnabled()) {
    console.warn('[challengeRoomService] Challenge match is disabled. Returning null.');
    return null;
  }

  try {
    const challengeSnap = await getDoc(doc(db, 'challengeRequests', challengeId));
    if (!challengeSnap.exists()) {
      console.warn('[challengeRoomService] Challenge not found:', challengeId);
      return null;
    }
    const challenge = challengeSnap.data() as ChallengeRequest;
    if (!challenge.roomId) {
      console.warn('[challengeRoomService] Room ID missing on challenge:', challengeId);
      return null;
    }

    const roomSnap = await getDoc(doc(db, 'multiplayerRooms', challenge.roomId));
    if (!roomSnap.exists()) {
      console.warn('[challengeRoomService] Room not found in Firestore:', challenge.roomId);
      return null;
    }
    const room = roomSnap.data() as MultiplayerRoom;

    if (uid !== challenge.fromUid && uid !== challenge.toUid) {
      console.warn('[challengeRoomService] User is not involved in this challenge:', uid);
      return null;
    }

    if (room.status !== 'ready' && room.status !== 'active') {
      console.warn('[challengeRoomService] Room is not ready or active:', room.status);
      return null;
    }

    const role = uid === challenge.fromUid ? 'host' : 'guest';
    const color = uid === challenge.fromUid ? 'w' : 'b';

    return {
      roomId: challenge.roomId,
      role,
      color
    };
  } catch (err) {
    console.error('[challengeRoomService] enterChallengeRoom failed:', err);
    return null;
  }
}
