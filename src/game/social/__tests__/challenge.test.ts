import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { 
  sendPokeChallenge, 
  acceptChallenge, 
  declineChallenge,
  getReceivedChallenges,
  getSentChallenges
} from '../challengeService';
import {
  acceptChallengeAndCreateRoom,
  enterChallengeRoom
} from '../challengeRoomService';
import { 
  validateChallengeTarget, 
  checkAndHandlePendingChallenge, 
  validateChallengeCooldown, 
  validateDailyChallengeLimit, 
  sanitizeAndValidateMessage 
} from '../challengeValidation';
import { buildPlayerPreviewFromLeaderboardEntry, getPlayerPublicPreview } from '../playerPreviewService';
import { createChallengeNotification } from '../notificationService';
import { createChallengeChatMessage } from '../chatInboxService';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { runTransaction } from '../../../firebase';
import { LeaderboardEntry } from '../../leaderboard/leaderboardTypes';

// Mock Firestore calls
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...original,
    doc: vi.fn().mockImplementation((dbInstance, path, ...rest) => {
      const id = rest[rest.length - 1] || path;
      return { id };
    }),
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
    runTransaction: vi.fn(),
  };
});

vi.mock('../../leaderboard/compLeaderboardService', () => ({
  getMyCompRank: vi.fn().mockResolvedValue(5),
}));

vi.mock('../../leaderboard/arenaLeaderboardService', () => ({
  getMyArenaRank: vi.fn().mockResolvedValue(10),
}));

let mockUser: any = { uid: 'user_123', displayName: 'Challenger Pro' };

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
  collection: (dbInstance: any, path: string, ...rest: string[]) => {
    const { collection } = require('firebase/firestore');
    return collection(dbInstance, path, ...rest);
  },
  getDocs: (query: any) => getDocs(query),
  runTransaction: vi.fn(),
}));

describe('Phase 23 Poke / Challenge System Tests', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_CHALLENGE_MATCH', 'true');
    vi.stubEnv('VITE_ENABLE_MULTIPLAYER', 'true');
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUser = { uid: 'user_123', displayName: 'Challenger Pro' };

    // Default mock behavior
    vi.mocked(doc).mockImplementation((dbInstance: any, path: string, ...rest: string[]) => {
      const id = rest[rest.length - 1] || path;
      return { id } as any;
    });
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => null
    } as any);
    vi.mocked(setDoc).mockResolvedValue(undefined as any);
    vi.mocked(updateDoc).mockResolvedValue(undefined as any);
    vi.mocked(getDocs).mockResolvedValue({
      empty: true,
      docs: []
    } as any);
    vi.mocked(runTransaction).mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe('1. Spam Protection & Validation Rules', () => {
    it('should block self-challenge', async () => {
      const targetVal = validateChallengeTarget('user_123', 'user_123');
      expect(targetVal.valid).toBe(false);
      expect(targetVal.reason).toContain('cannot poke or challenge yourself');

      const res = await sendPokeChallenge('user_123', 'Challenger Pro', 'poke', 'comp_kings');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('cannot poke or challenge yourself');
    });

    it('should block unauthenticated challenge', async () => {
      mockUser = null;
      const targetVal = validateChallengeTarget(null, 'user_456');
      expect(targetVal.valid).toBe(false);

      const res = await sendPokeChallenge('user_456', 'Target Player', 'challenge', 'comp_kings');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('Sender must be authenticated');
    });

    it('should block when there is already a pending duplicate', async () => {
      // Mock getDocs to return a pending challenge
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{
          id: 'chal_111',
          data: () => ({
            id: 'chal_111',
            fromUid: 'user_123',
            toUid: 'user_456',
            status: 'pending',
            expiresAt: Date.now() + 100000 // future
          })
        }]
      } as any);

      const canChallenge = await checkAndHandlePendingChallenge('user_123', 'user_456');
      expect(canChallenge).toBe(false);

      const res = await sendPokeChallenge('user_456', 'Target Player', 'challenge', 'comp_kings');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('active pending challenge request');
    });

    it('should allow challenge if existing pending is expired, and expire it first', async () => {
      // Mock getDocs to return an expired challenge
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{
          id: 'chal_111',
          data: () => ({
            id: 'chal_111',
            fromUid: 'user_123',
            toUid: 'user_456',
            status: 'pending',
            expiresAt: Date.now() - 1000 // expired
          })
        }]
      } as any);

      const canChallenge = await checkAndHandlePendingChallenge('user_123', 'user_456');
      expect(canChallenge).toBe(true);
      expect(vi.mocked(updateDoc)).toHaveBeenCalled();
    });

    it('should block when cooldown of 10 minutes is active', async () => {
      // Mock getDocs to return a challenge created 5 minutes ago
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{
          id: 'chal_recent',
          data: () => ({
            createdAt: Date.now() - 5 * 60 * 1000
          })
        }]
      } as any);

      const allowed = await validateChallengeCooldown('user_123', 'user_456');
      expect(allowed).toBe(false);

      const res = await sendPokeChallenge('user_456', 'Target Player', 'challenge', 'comp_kings');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('wait 10 minutes');
    });

    it('should block when daily outgoing challenge limit is exceeded (after 20)', async () => {
      // Mock getDocs to return 20 challenges created within the last 24 hours
      const docs = Array.from({ length: 20 }, (_, i) => ({
        id: `chal_${i}`,
        data: () => ({
          createdAt: Date.now() - 11 * 60 * 1000 - i * 10 * 60 * 1000
        })
      }));

      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs
      } as any);

      const allowed = await validateDailyChallengeLimit('user_123');
      expect(allowed).toBe(false);

      const res = await sendPokeChallenge('user_456', 'Target Player', 'challenge', 'comp_kings');
      expect(res.success).toBe(false);
      expect(res.reason).toContain('Daily limit of 20 outgoing challenges');
    });
  });

  describe('2. Message Processing Rules', () => {
    it('should trim whitespace and cap message length at 120 characters', () => {
      const baseMsg = '   Play me! '.repeat(20); // very long message
      const sanitized = sanitizeAndValidateMessage(baseMsg);
      expect(sanitized.length).toBeLessThanOrEqual(120);
      expect(sanitized.startsWith('Play me!')).toBe(true);
      expect(sanitized.endsWith(' ')).toBe(false);
    });

    it('should block links/URLs and fallback to safe default message', () => {
      const badMsg = 'Play here: https://cheatcode.com/win';
      const sanitized = sanitizeAndValidateMessage(badMsg);
      expect(sanitized).toBe('I challenge you to a friendly match of chess! May the best strategist win!');
    });

    it('should fallback to default if message is empty', () => {
      const sanitized = sanitizeAndValidateMessage('    ');
      expect(sanitized).toBe('I challenge you to a friendly match of chess! May the best strategist win!');
    });
  });

  describe('3. Creation Order & Reference Integrity', () => {
    it('should create ChallengeRequest first, then Notification, then ChatInbox item referencing the ID', async () => {
      const setDocOrder: string[] = [];
      vi.mocked(setDoc).mockImplementation(async (ref: any) => {
        // Collect reference paths written
        setDocOrder.push(ref.id || 'unknown');
        return undefined;
      });

      const res = await sendPokeChallenge('user_456', 'Target Player', 'challenge', 'comp_kings');
      expect(res.success).toBe(true);
      expect(res.challengeRequest).toBeDefined();

      const challengeId = res.challengeRequest!.id;
      
      // Verify challengeRequestId references inside notification/chat inbox creations
      expect(setDocOrder.length).toBe(3);
      // The first should be the challenge request setDoc (creates the request document)
      // The service does:
      // 1. setDoc(doc(db, 'challengeRequests', challengeId), challengeRequest)
      // 2. setDoc(notifRef, notification)
      // 3. setDoc(msgRef, chatInboxItem)
      expect(setDocOrder[0]).toContain(challengeId);
    });

    it('should create notification and inbox items with proper challengeRequestId reference', async () => {
      const challengeRequest = {
        id: 'test_chal_id_999',
        fromUid: 'user_123',
        toUid: 'user_456',
        fromName: 'Challenger Pro',
        type: 'challenge' as const,
        mode: 'friendly_duel' as const,
        status: 'pending' as const,
        message: 'Let us play chess',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        fromMode: 'comp_kings' as const
      };

      let writtenNotification: any = null;
      let writtenChatInbox: any = null;

      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('notif_')) {
          writtenNotification = data;
        } else if (ref.id.startsWith('msg_')) {
          writtenChatInbox = data;
        }
        return undefined;
      });

      await createChallengeNotification(challengeRequest);
      await createChallengeChatMessage(challengeRequest);

      expect(writtenNotification).toBeDefined();
      expect(writtenNotification.challengeRequestId).toBe('test_chal_id_999');
      expect(writtenNotification.type).toBe('challenge_request');
      expect(writtenNotification.read).toBe(false);

      expect(writtenChatInbox).toBeDefined();
      expect(writtenChatInbox.challengeRequestId).toBe('test_chal_id_999');
      expect(writtenChatInbox.type).toBe('challenge_request');
      expect(writtenChatInbox.read).toBe(false);
    });
  });

  describe('4. Accept/Decline & Expiry Enforcement', () => {
    it('should allow receiver to accept or decline the challenge', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          id: 'chal_xyz',
          fromUid: 'user_456',
          toUid: 'user_123', // current user is user_123
          status: 'pending',
          expiresAt: Date.now() + 100000
        })
      } as any);

      const acceptRes = await acceptChallenge('chal_xyz', 'user_123');
      expect(acceptRes.success).toBe(true);
      expect(vi.mocked(updateDoc)).toHaveBeenCalled();

      const declineRes = await declineChallenge('chal_xyz', 'user_123');
      expect(declineRes.success).toBe(true);
    });

    it('should block non-receiver from accepting or declining', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          id: 'chal_xyz',
          fromUid: 'user_456',
          toUid: 'user_789', // target is user_789, but caller is user_123
          status: 'pending',
          expiresAt: Date.now() + 100000
        })
      } as any);

      const acceptRes = await acceptChallenge('chal_xyz', 'user_123');
      expect(acceptRes.success).toBe(false);
      expect(acceptRes.reason).toContain('not the receiver');

      const declineRes = await declineChallenge('chal_xyz', 'user_123');
      expect(declineRes.success).toBe(false);
      expect(declineRes.reason).toContain('not the receiver');
    });

    it('should block acceptance of expired challenge and mark it expired', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          id: 'chal_xyz',
          fromUid: 'user_456',
          toUid: 'user_123',
          status: 'pending',
          expiresAt: Date.now() - 5000 // expired
        })
      } as any);

      const acceptRes = await acceptChallenge('chal_xyz', 'user_123');
      expect(acceptRes.success).toBe(false);
      expect(acceptRes.reason).toContain('expired');
      expect(vi.mocked(updateDoc)).toHaveBeenCalled();
    });
  });

  describe('5. Source Wording Labels', () => {
    it('should correctly format message for Comp Kings source label', async () => {
      const challengeRequest = {
        id: 'test_comp',
        fromUid: 'user_123',
        toUid: 'user_456',
        fromName: 'Challenger Pro',
        type: 'challenge' as const,
        mode: 'friendly_duel' as const,
        status: 'pending' as const,
        message: 'Let us play chess',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        fromMode: 'comp_kings' as const,
        fromRank: 3
      };

      let writtenChatInbox: any = null;
      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('msg_')) {
          writtenChatInbox = data;
        }
        return undefined;
      });

      await createChallengeChatMessage(challengeRequest);
      expect(writtenChatInbox).toBeDefined();
      expect(writtenChatInbox.message).toContain('Comp Kings');
      expect(writtenChatInbox.message).toContain('Rank #3');
    });

    it('should correctly format message for Arena Kings source label', async () => {
      const challengeRequest = {
        id: 'test_arena',
        fromUid: 'user_123',
        toUid: 'user_456',
        fromName: 'Challenger Pro',
        type: 'challenge' as const,
        mode: 'friendly_duel' as const,
        status: 'pending' as const,
        message: 'Let us play chess',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        fromMode: 'arena_kings' as const,
        fromRank: 15
      };

      let writtenChatInbox: any = null;
      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('msg_')) {
          writtenChatInbox = data;
        }
        return undefined;
      });

      await createChallengeChatMessage(challengeRequest);
      expect(writtenChatInbox).toBeDefined();
      expect(writtenChatInbox.message).toContain('Arena Kings');
      expect(writtenChatInbox.message).toContain('Rank #15');
    });
  });

  describe('6. Player Preview compilation', () => {
    it('should build preview from LeaderboardEntry correctly', () => {
      const entry: LeaderboardEntry = {
        uid: 'user_preview',
        displayName: 'Royal Knight',
        mode: 'comp_kings',
        rank: 2,
        score: 1500,
        badges: ['Grandmaster', 'Cup Champion'],
        updatedAt: Date.now(),
        compStats: {
          compElo: 1450,
          compTier: 'master',
          compWins: 45,
          compMatches: 50,
          compWinStreak: 7,
          completedMasterCups: 2,
          grandmasterDefeated: true
        }
      };

      const preview = buildPlayerPreviewFromLeaderboardEntry(entry);
      expect(preview.uid).toBe('user_preview');
      expect(preview.name).toBe('Royal Knight');
      expect(preview.compRank).toBe(2);
      expect(preview.arenaRank).toBe(-1);
      expect(preview.compElo).toBe(1450);
      expect(preview.badges).toContain('Grandmaster');
      expect(preview.badges).toContain('Cup Champion');
    });

    it('should compile public preview from doc and ranks correctly', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Royal Knight',
          rating: 1300,
          badges: ['Elite'],
          aiProgress: {
            elo: 1350,
            tier: 'master'
          },
          multiplayerHistory: [
            { result: 'win' },
            { result: 'win' },
            { result: 'loss' }
          ]
        })
      } as any);

      const preview = await getPlayerPublicPreview('user_preview');
      expect(preview).toBeDefined();
      expect(preview!.name).toBe('Royal Knight');
      expect(preview!.compRank).toBe(5); // Mocked getMyCompRank returns 5
      expect(preview!.arenaRank).toBe(10); // Mocked getMyArenaRank returns 10
      expect(preview!.compElo).toBe(1350);
      expect(preview!.arenaWins).toBe(2);
      expect(preview!.arenaLosses).toBe(1);
      expect(preview!.arenaMatches).toBe(3);
      expect(preview!.arenaWinRate).toBe(67);
      expect(preview!.badges).toContain('Elite');
    });
  });

  describe('7. Challenge Friend Room Auto-Creation (Phase 24)', () => {
    beforeEach(() => {
      // Mock runTransaction to execute the callback with a mock transaction
      vi.mocked(runTransaction).mockImplementation(async (dbInstance, updateFn) => {
        const transaction = {
          get: vi.fn().mockImplementation(async (ref) => getDoc(ref)),
          set: vi.fn().mockImplementation((ref, data) => { setDoc(ref, data); }),
          update: vi.fn().mockImplementation((ref, data) => { updateDoc(ref, data); })
        };
        return updateFn(transaction as any);
      });
    });

    it('should auto-create a Friend room when receiver accepts the challenge', async () => {
      const challengeId = 'chal_12345';
      const receiverUid = 'user_123';
      
      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        fromName: 'Host Player',
        toUid: receiverUid,
        toName: 'Guest Player',
        type: 'challenge',
        status: 'pending',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };

      vi.mocked(getDoc).mockImplementation(async (ref: any) => {
        if (ref.id === challengeId) {
          return {
            exists: () => true,
            data: () => challengeData
          } as any;
        }
        return { exists: () => false, data: () => null } as any;
      });

      let createdRoom: any = null;
      let updatedChallenge: any = null;

      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('CH-')) {
          createdRoom = data;
        }
        return undefined;
      });

      vi.mocked(updateDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id === challengeId) {
          updatedChallenge = data;
        }
        return undefined;
      });

      const res = await acceptChallengeAndCreateRoom(challengeId, receiverUid);
      expect(res.success).toBe(true);
      expect(res.roomId).toBe('CH-chal_123');
      
      // Verify room details
      expect(createdRoom).toBeDefined();
      expect(createdRoom.roomId).toBe('CH-chal_123');
      expect(createdRoom.hostUid).toBe('user_456');
      expect(createdRoom.guestUid).toBe('user_123');
      expect(createdRoom.status).toBe('ready');
      expect(createdRoom.hostColor).toBe('w');
      expect(createdRoom.guestColor).toBe('b');
      expect(createdRoom.source).toBe('challenge');

      // Verify challenge request updates
      expect(updatedChallenge).toBeDefined();
      expect(updatedChallenge.status).toBe('accepted');
      expect(updatedChallenge.roomId).toBe('CH-chal_123');
      expect(updatedChallenge.roomStatus).toBe('created');
    });

    it('should not create a room if challenge type is poke', async () => {
      const challengeId = 'chal_poke_123';
      const receiverUid = 'user_123';

      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        fromName: 'Host Player',
        toUid: receiverUid,
        toName: 'Guest Player',
        type: 'poke',
        status: 'pending',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };

      vi.mocked(getDoc).mockImplementation(async (ref: any) => {
        if (ref.id === challengeId) {
          return {
            exists: () => true,
            data: () => challengeData
          } as any;
        }
        return { exists: () => false, data: () => null } as any;
      });

      let createdRoom = null;
      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('CH-')) {
          createdRoom = data;
        }
        return undefined;
      });

      const res = await acceptChallengeAndCreateRoom(challengeId, receiverUid);
      expect(res.success).toBe(true);
      expect(res.roomId).toBeUndefined();
      expect(createdRoom).toBeNull();
    });

    it('should block non-receivers from accepting', async () => {
      const challengeId = 'chal_12345';
      const receiverUid = 'user_999';

      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        toUid: 'user_123',
        type: 'challenge',
        status: 'pending',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => challengeData
      } as any);

      const res = await acceptChallengeAndCreateRoom(challengeId, receiverUid);
      expect(res.success).toBe(false);
      expect(res.reason).toContain('not the receiver');
    });

    it('should block expired challenges from being accepted', async () => {
      const challengeId = 'chal_12345';
      const receiverUid = 'user_123';

      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        toUid: 'user_123',
        type: 'challenge',
        status: 'pending',
        expiresAt: Date.now() - 5000
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => challengeData
      } as any);

      const res = await acceptChallengeAndCreateRoom(challengeId, receiverUid);
      expect(res.success).toBe(false);
      expect(res.reason).toContain('expired');
    });

    it('should return existing roomId on double accept', async () => {
      const challengeId = 'chal_12345';
      const receiverUid = 'user_123';

      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        toUid: 'user_123',
        type: 'challenge',
        status: 'accepted',
        roomId: 'CH-chal_123',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => challengeData
      } as any);

      let createdRoom = null;
      vi.mocked(setDoc).mockImplementation(async (ref: any, data: any) => {
        if (ref.id.startsWith('CH-')) {
          createdRoom = data;
        }
        return undefined;
      });

      const res = await acceptChallengeAndCreateRoom(challengeId, receiverUid);
      expect(res.success).toBe(true);
      expect(res.roomId).toBe('CH-chal_123');
      expect(createdRoom).toBeNull();
    });

    it('should construct enterChallengeRoom config correctly', async () => {
      const challengeId = 'chal_12345';
      const challengeData = {
        id: challengeId,
        fromUid: 'user_456',
        toUid: 'user_123',
        roomId: 'CH-chal_123',
        status: 'accepted'
      };

      const roomData = {
        roomId: 'CH-chal_123',
        status: 'ready'
      };

      vi.mocked(getDoc).mockImplementation(async (ref: any) => {
        if (ref.id === challengeId) {
          return { exists: () => true, data: () => challengeData } as any;
        }
        if (ref.id === 'CH-chal_123') {
          return { exists: () => true, data: () => roomData } as any;
        }
        return { exists: () => false } as any;
      });

      const configHost = await enterChallengeRoom(challengeId, 'user_456');
      expect(configHost).toEqual({
        roomId: 'CH-chal_123',
        role: 'host',
        color: 'w'
      });

      const configGuest = await enterChallengeRoom(challengeId, 'user_123');
      expect(configGuest).toEqual({
        roomId: 'CH-chal_123',
        role: 'guest',
        color: 'b'
      });

      const configStranger = await enterChallengeRoom(challengeId, 'user_999');
      expect(configStranger).toBeNull();
    });
  });
});
