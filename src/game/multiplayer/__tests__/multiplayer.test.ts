import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFriendRoom, getRoom, joinRoom, cancelRoom, markRoomActive, completeRoom } from '../multiplayerRoomService';
import { createInvitePayload, parseInvitePayload, validateInvitePayload } from '../multiplayerInvite';
import { submitMove } from '../multiplayerMoveService';
import { setPlayerOnline, setPlayerOffline, updateLastSeen } from '../multiplayerPresenceService';
import { submitResult, validateResult } from '../multiplayerResultService';
import { 
  validatePlayerInRoom, 
  validateTurn, 
  validateMoveNumber, 
  validateRoomStatus, 
  validateRoomStatusTransition, 
  validateLegalMove 
} from '../multiplayerValidation';
import { createDrawOffer, getActiveDrawOffer, acceptDrawOffer, declineDrawOffer } from '../multiplayerDrawService';
import { cleanupStaleWaitingRooms, markRoomStaleIfExpired, cleanupRoomListeners, registerSubscription } from '../multiplayerCleanupService';
import { addMultiplayerHistoryItem, getMultiplayerHistory } from '../multiplayerHistoryService';
import { doc, getDoc, setDoc, updateDoc, writeBatch, getDocs, onSnapshot } from 'firebase/firestore';
import { savePlayerData } from '../../../lib/store';

// Mock local storage store and sync manager
vi.mock('../../../lib/store', () => ({
  savePlayerData: vi.fn(),
}));

vi.mock('../../../lib/cloud/cloudSyncManager', () => ({
  triggerDebouncedSync: vi.fn(),
}));

// Mock Firestore calls
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    doc: vi.fn().mockReturnValue({ id: 'doc_123' }),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    onSnapshot: vi.fn(),
    getDocs: vi.fn(),
    limit: vi.fn(),
    writeBatch: vi.fn().mockReturnValue({
      update: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    }),
  };
});

let mockUser: any = { uid: 'host_123' };

vi.mock('../../../firebase', () => ({
  auth: {
    get currentUser() {
      return mockUser;
    }
  },
  db: {},
  doc: (dbInstance: any, path: string, ...rest: string[]) => doc(dbInstance, path, ...rest),
  getDoc: (docRef: any) => getDoc(docRef),
  setDoc: (docRef: any, data: any) => setDoc(docRef, data),
  updateDoc: (docRef: any, data: any) => updateDoc(docRef, data),
  writeBatch: (dbInstance: any) => writeBatch(dbInstance),
  collection: (dbInstance: any, path: string, ...rest: string[]) => {
    const { collection } = require('firebase/firestore');
    return collection(dbInstance, path, ...rest);
  },
  getDocs: (query: any) => getDocs(query),
  onSnapshot: (query: any, callback: any) => onSnapshot(query, callback)
}));

describe('Online Friend Match Multiplayer System (Phase 20)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_MULTIPLAYER', 'true');
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mock behavior for Firestore calls
    vi.mocked(doc).mockReturnValue({ id: 'room_123' } as any);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => null
    } as any);
    vi.mocked(setDoc).mockResolvedValue(undefined as any);
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. Room Service CRUD & Safe Status Transitions', () => {
    it('should create a room with waiting status', async () => {
      const room = await createFriendRoom('host_123', 'Sire Host');
      expect(room.hostUid).toBe('host_123');
      expect(room.hostName).toBe('Sire Host');
      expect(room.status).toBe('waiting');
      expect(room.currentTurn).toBe('w');
      expect(room.moveCount).toBe(0);
      expect(vi.mocked(setDoc)).toHaveBeenCalled();
    });

    it('should allow a guest to join a room', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          roomId: 'room_123',
          hostUid: 'host_123',
          hostName: 'Sire Host',
          status: 'waiting',
        })
      } as any);

      const room = await joinRoom('room_123', 'guest_123', 'Dame Guest');
      expect(room.guestUid).toBe('guest_123');
      expect(room.guestName).toBe('Dame Guest');
      expect(room.status).toBe('ready');
      expect(vi.mocked(updateDoc)).toHaveBeenCalled();
    });

    it('should block a guest from joining a full room', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          roomId: 'room_123',
          hostUid: 'host_123',
          hostName: 'Sire Host',
          guestUid: 'guest_123',
          guestName: 'Dame Guest',
          status: 'waiting',
        })
      } as any);

      await expect(joinRoom('room_123', 'hacker_123', 'Lurker')).rejects.toThrow();
    });

    it('should enforce waiting -> ready -> active -> completed safe transitions', () => {
      expect(validateRoomStatusTransition('waiting', 'ready')).toBe(true);
      expect(validateRoomStatusTransition('ready', 'active')).toBe(true);
      expect(validateRoomStatusTransition('active', 'completed')).toBe(true);
      expect(validateRoomStatusTransition('active', 'abandoned')).toBe(true);
      expect(validateRoomStatusTransition('waiting', 'cancelled')).toBe(true);
      expect(validateRoomStatusTransition('ready', 'cancelled')).toBe(true);

      // Blocked transitions
      expect(validateRoomStatusTransition('completed', 'active')).toBe(false);
      expect(validateRoomStatusTransition('cancelled', 'active')).toBe(false);
      expect(validateRoomStatusTransition('abandoned', 'active')).toBe(false);
    });
  });

  describe('2. Invite Service Payload Parsing & Expiration', () => {
    it('should encode and decode invite payloads successfully', () => {
      const payloadStr = createInvitePayload('room_abc', 'host_123');
      const parsed = parseInvitePayload(payloadStr);

      expect(parsed).not.toBeNull();
      expect(parsed?.roomId).toBe('room_abc');
      expect(parsed?.hostUid).toBe('host_123');
      expect(parsed?.type).toBe('multiplayer_invite');
    });

    it('should reject invite payloads that are older than 5 minutes', () => {
      const payload = {
        type: 'multiplayer_invite',
        roomId: 'room_abc',
        hostUid: 'host_123',
        createdAt: Date.now() - (6 * 60 * 1000), // 6 minutes ago
      };

      expect(validateInvitePayload(payload)).toBe(false);
    });

    it('should validate fresh invite payloads correctly', () => {
      const payload = {
        type: 'multiplayer_invite',
        roomId: 'room_abc',
        hostUid: 'host_123',
        createdAt: Date.now() - (2 * 60 * 1000), // 2 minutes ago
      };

      expect(validateInvitePayload(payload)).toBe(true);
    });
  });

  describe('3. Move Submission & Legality Validation', () => {
    it('should validate player membership and turns correctly', () => {
      const room = {
        roomId: 'room_123',
        hostUid: 'host_123',
        hostName: 'Sire Host',
        guestUid: 'guest_123',
        guestName: 'Dame Guest',
        status: 'active' as const,
        fen: '',
        currentTurn: 'w' as const,
        moveCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(validatePlayerInRoom(room, 'host_123')).toBe(true);
      expect(validatePlayerInRoom(room, 'guest_123')).toBe(true);
      expect(validatePlayerInRoom(room, 'stranger')).toBe(false);

      // Turn checking: only host can move on white turn
      expect(validateTurn(room, 'host_123', 'w')).toBe(true);
      expect(validateTurn(room, 'guest_123', 'w')).toBe(false);
      expect(validateTurn(room, 'host_123', 'b')).toBe(false);
    });

    it('should assert sequential move numbers correctly', () => {
      const room = {
        roomId: 'room_123',
        hostUid: 'host_123',
        hostName: 'Sire Host',
        guestUid: 'guest_123',
        guestName: 'Dame Guest',
        status: 'active' as const,
        fen: '',
        currentTurn: 'w' as const,
        moveCount: 4,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(validateMoveNumber(room, 5)).toBe(true);
      expect(validateMoveNumber(room, 4)).toBe(false);
      expect(validateMoveNumber(room, 6)).toBe(false);
    });

    it('should check chess legality on mock boards', () => {
      const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Legal move: pawn e2 to e4
      expect(validateLegalMove(startFen, { from: 'e2', to: 'e4' })).toBe(true);

      // Illegal move: rook a1 to a5 (pawn in between)
      expect(validateLegalMove(startFen, { from: 'a1', to: 'a5' })).toBe(false);
    });
  });

  describe('4. Presence Syncing & Heartbeats', () => {
    it('should call setDoc when setting players online or offline', async () => {
      await setPlayerOnline('room_123', 'host_123');
      expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(1);

      await setPlayerOffline('room_123', 'host_123');
      expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(2);
    });

    it('should handle lastSeen updates and heartbeat syncs', async () => {
      await updateLastSeen('room_123', 'host_123');
      expect(vi.mocked(updateDoc)).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Results Submission Validation', () => {
    it('should validate proper result formats', () => {
      const validResult = {
        winnerUid: 'host_123',
        winnerColor: 'w' as const,
        status: 'completed' as const,
        reason: 'checkmate' as const,
        endedAt: Date.now(),
      };

      const invalidResult = {
        winnerUid: 'host_123',
        winnerColor: 'w',
        status: 'hacked', // Invalid
        reason: 'checkmate',
        endedAt: Date.now(),
      };

      expect(validateResult(validResult)).toBe(true);
      expect(validateResult(invalidResult)).toBe(false);
    });
  });

  describe('6. Phase 21 Polish (Draws, Resignation, History, Cleanup)', () => {
    it('accept draw completes room', async () => {
      const mockBatch = {
        update: vi.fn(),
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined)
      };
      vi.mocked(writeBatch).mockReturnValue(mockBatch as any);

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          offerId: 'offer_123',
          roomId: 'room_123',
          fromUid: 'host_123',
          toUid: 'guest_123',
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        })
      } as any);

      await acceptDrawOffer('room_123', 'offer_123', 'guest_123');

      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('declined draw keeps room active', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          offerId: 'offer_123',
          roomId: 'room_123',
          fromUid: 'host_123',
          toUid: 'guest_123',
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        })
      } as any);

      await declineDrawOffer('room_123', 'offer_123', 'guest_123');
      expect(updateDoc).toHaveBeenCalledWith(expect.any(Object), { status: 'declined' });
    });

    it('expired draw cannot be accepted', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          offerId: 'offer_123',
          roomId: 'room_123',
          fromUid: 'host_123',
          toUid: 'guest_123',
          status: 'pending',
          createdAt: Date.now() - 70000,
          expiresAt: Date.now() - 10000,
        })
      } as any);

      await expect(acceptDrawOffer('room_123', 'offer_123', 'guest_123'))
        .rejects.toThrow('Draw offer has expired.');
    });

    it('resign cannot double-submit result (idempotency)', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          roomId: 'room_123',
          hostUid: 'host_123',
          guestUid: 'guest_123',
          status: 'completed',
          result: { status: 'completed', reason: 'checkmate', endedAt: Date.now() }
        })
      } as any);

      const result = {
        winnerUid: 'guest_123',
        winnerColor: 'b' as const,
        status: 'completed' as const,
        reason: 'resign' as const,
        endedAt: Date.now(),
      };

      vi.mocked(updateDoc).mockClear();
      vi.mocked(setDoc).mockClear();

      await submitResult('room_123', result);

      expect(updateDoc).not.toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('room full checks guestUid', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          roomId: 'room_123',
          hostUid: 'host_123',
          guestUid: 'guest_123',
          status: 'waiting',
        })
      } as any);

      await expect(joinRoom('room_123', 'another_guest_123', 'Another Guest'))
        .rejects.toThrow('Room is already full.');
    });

    it('abandon result does not award ELO', async () => {
      const playerData: any = {
        uid: 'user_123',
        name: 'Sire Knight',
        rating: 1200,
        wins: 10,
        losses: 5,
        draws: 2,
        streak: 0,
        bestStreak: 0,
        musicOn: true,
        sfxOn: true,
        isPremium: false,
        cameraSensitivity: 1,
        fontSize: 1,
        tier: 1,
        char: 0,
        consecLoss: 0,
        hardLocked: false,
        showHints: true,
        undoEnabled: true,
        language: 'en',
        whiteWins: 0,
        whiteLosses: 0,
        blackWins: 0,
        blackLosses: 0,
        whiteTime: 0,
        blackTime: 0,
        viewMode: '2d',
        dailyUndoCount: 0,
        lastUndoDate: '',
        selectedPieceSet: 'classic',
        homeAnimation: '',
        boardTheme: 'classic',
        preferredSide: 'w',
        aiProgress: {
          coins: 100,
          xp: 50,
          currentLevel: 1,
          completedLevels: [],
          unlockedTiers: [0],
          statistics: { totalMatches: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, bestStreak: 0, winStreak: 0 }
        },
        multiplayerHistory: [],
      };

      const historyItem = {
        roomId: 'room_123',
        opponentUid: 'guest_123',
        opponentName: 'Dame Guest',
        result: 'abandoned' as const,
        reason: 'disconnect' as const,
        playedAt: Date.now(),
        moves: 10,
      };

      const updated = addMultiplayerHistoryItem(playerData, historyItem);
      expect(updated.rating).toBe(1200); // Check ELO rating is unchanged
      expect(updated.multiplayerHistory!.length).toBe(1);
      expect(updated.multiplayerHistory![0]).toEqual(historyItem);
      expect(savePlayerData).toHaveBeenCalledWith(updated);
    });

    it('listener cleanup works safely', () => {
      const roomId = 'room_cleanup_123';
      const unsubSpy = vi.fn();

      registerSubscription(roomId, unsubSpy);
      cleanupRoomListeners(roomId);

      expect(unsubSpy).toHaveBeenCalled();
    });
  });
});
