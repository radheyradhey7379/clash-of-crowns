import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { realtimeMultiplayerAdapter } from '../realtimeMultiplayerAdapter';
import { rustRoomBridge } from '../rustRoomBridge';
import { realtimeClient } from '../../../services/realtime/realtimeClient';

// Mock Firestore services

vi.mock('../multiplayerMoveService', () => ({
  submitMove: vi.fn().mockResolvedValue(undefined),
  subscribeToMoves: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../multiplayerResultService', () => ({
  submitResult: vi.fn().mockResolvedValue(undefined),
  subscribeToResult: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../multiplayerDrawService', () => ({
  createDrawOffer: vi.fn().mockResolvedValue(undefined),
  subscribeToDrawOffers: vi.fn().mockReturnValue(vi.fn()),
  acceptDrawOffer: vi.fn().mockResolvedValue(undefined),
  declineDrawOffer: vi.fn().mockResolvedValue(undefined),
  getActiveDrawOffer: vi.fn().mockResolvedValue(null),
}));

vi.mock('../multiplayerPresenceService', () => ({
  setPlayerOnline: vi.fn().mockResolvedValue(undefined),
  setPlayerOffline: vi.fn().mockResolvedValue(undefined),
  updateLastSeen: vi.fn().mockResolvedValue(undefined),
  subscribeToPresence: vi.fn().mockReturnValue(vi.fn()),
}));

// Mock rustRoomBridge and realtimeClient
vi.mock('../rustRoomBridge', () => {
  const actual = vi.importActual('../rustRoomBridge');
  return {
    rustRoomBridge: {
      initRustFriendRoom: vi.fn(),
      submitRustMove: vi.fn(),
      listenRustOpponentMoves: vi.fn(),
      listenRustMatchEnd: vi.fn(),
      listenRustDrawOffer: vi.fn(),
      listenRustDrawDeclined: vi.fn(),
      offerRustDraw: vi.fn(),
      respondRustDraw: vi.fn(),
      resignRustRoom: vi.fn(),
      closeRustRoom: vi.fn(),
      submitRustRankedResult: vi.fn(),
      listenRustRankedResultVerified: vi.fn(),
      listenRustRankedResultError: vi.fn(),
    },
  };
});

vi.mock('../../../services/realtime/realtimeClient', () => {
  return {
    realtimeClient: {
      connectRealtime: vi.fn(),
      disconnectRealtime: vi.fn(),
      createRealtimeRoom: vi.fn(),
      joinRealtimeRoom: vi.fn(),
      sendPlayerReady: vi.fn(),
      submitRealtimeMove: vi.fn(),
      offerRealtimeDraw: vi.fn(),
      respondRealtimeDraw: vi.fn(),
      resignRealtimeRoom: vi.fn(),
      onRealtimeMessage: vi.fn(),
      onRealtimeStatus: vi.fn(),
      getRealtimeStatus: vi.fn().mockReturnValue('idle'),
      isRealtimeAvailable: vi.fn().mockReturnValue(false),
      setActiveRoom: vi.fn(),
    },
  };
});

describe('Realtime Multiplayer Adapter & WS Fallback tests', () => {
  let globalFetchSpy: any;

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_MULTIPLAYER', 'true');
    vi.stubEnv('VITE_ENABLE_RUST_REALTIME', 'true');
    vi.restoreAllMocks();
    vi.clearAllMocks();
    
    // Default environment variables mock using vi.stubEnv
    vi.stubEnv('VITE_ENABLE_RUST_REALTIME', 'true');
    vi.stubEnv('VITE_REALTIME_HTTP_URL', 'http://localhost:3001');
    vi.stubEnv('VITE_REALTIME_WS_URL', 'ws://localhost:3001/ws');

    // Mock global fetch
    globalFetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', service: 'clash-realtime' }),
      } as any)
    );
  });

  afterEach(() => {
    realtimeMultiplayerAdapter.dispose();
    vi.unstubAllEnvs();
  });

  it('should use Firestore when VITE_ENABLE_RUST_REALTIME is false', async () => {
    // Override flag
    vi.stubEnv('VITE_ENABLE_RUST_REALTIME', 'false');

    const onReady = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_123',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      onOpponentMove: vi.fn(),
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady,
    });

    expect(realtimeMultiplayerAdapter.getTransport()).toBe('firestore');
    expect(onReady).toHaveBeenCalled();
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  it('should fallback to Firestore when health check fails', async () => {
    // Health check returns error
    globalFetchSpy.mockImplementationOnce(() => Promise.reject(new Error('Network offline')));

    const onReady = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_123',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      onOpponentMove: vi.fn(),
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady,
    });

    expect(realtimeMultiplayerAdapter.getTransport()).toBe('firestore');
    expect(onReady).toHaveBeenCalled();
  });

  it('should select Rust WS when health check is ok and WS readies successfully', async () => {
    // Mock rustRoomBridge to trigger onReady callback immediately
    vi.mocked(rustRoomBridge.initRustFriendRoom).mockImplementation((config, callbacks) => {
      callbacks.onReady();
    });

    const onReady = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_123',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      onOpponentMove: vi.fn(),
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady,
    });

    expect(realtimeMultiplayerAdapter.getTransport()).toBe('rust_ws');
    expect(onReady).toHaveBeenCalled();
    expect(rustRoomBridge.initRustFriendRoom).toHaveBeenCalled();
  });

  it('should fallback to Firestore if Rust WS handshake fails before active', async () => {
    // Mock rustRoomBridge to trigger onError callback immediately
    vi.mocked(rustRoomBridge.initRustFriendRoom).mockImplementation((config, callbacks) => {
      callbacks.onError('auth_failed', 'Incorrect credentials');
    });

    const onReady = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_123',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      onOpponentMove: vi.fn(),
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady,
    });

    expect(realtimeMultiplayerAdapter.getTransport()).toBe('firestore');
    expect(onReady).toHaveBeenCalled();
    expect(rustRoomBridge.closeRustRoom).toHaveBeenCalled();
  });

  it('should filter out duplicate opponent moves based on moveNumber', async () => {
    let opponentMoveHandler: any = null;
    vi.mocked(rustRoomBridge.initRustFriendRoom).mockImplementation((config, callbacks) => {
      callbacks.onReady();
    });
    vi.mocked(rustRoomBridge.listenRustOpponentMoves).mockImplementation((callback) => {
      opponentMoveHandler = callback;
    });

    const onOpponentMove = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_123',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      onOpponentMove,
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady: vi.fn(),
    });

    // Send first move (moveNumber = 1)
    opponentMoveHandler({ roomId: 'room_123', moveNumber: 1, from: 'e2', to: 'e4', fenAfter: '...' });
    expect(onOpponentMove).toHaveBeenCalledTimes(1);

    // Send duplicate move (moveNumber = 1)
    opponentMoveHandler({ roomId: 'room_123', moveNumber: 1, from: 'e2', to: 'e4', fenAfter: '...' });
    // Move count should still be 1 (ignored duplicate)
    expect(onOpponentMove).toHaveBeenCalledTimes(1);

    // Send newer move (moveNumber = 2)
    opponentMoveHandler({ roomId: 'room_123', moveNumber: 2, from: 'd7', to: 'd5', fenAfter: '...' });
    expect(onOpponentMove).toHaveBeenCalledTimes(2);
  });

  it('should support ranked result submission over Rust WS', async () => {
    vi.mocked(rustRoomBridge.initRustFriendRoom).mockImplementation((config, callbacks) => {
      callbacks.onReady();
    });

    const onReady = vi.fn();
    const onRankedResultVerified = vi.fn();
    await realtimeMultiplayerAdapter.initFriendMatch({
      roomId: 'room_ranked',
      role: 'host',
      color: 'w',
      uid: 'user_1',
      displayName: 'Player 1',
      rating: 1500,
      mode: 'ranked_arena',
      onOpponentMove: vi.fn(),
      onMatchEnd: vi.fn(),
      onOpponentPresence: vi.fn(),
      onDrawOfferReceived: vi.fn(),
      onDrawOfferSent: vi.fn(),
      onReady,
      onRankedResultVerified,
    });

    expect(realtimeMultiplayerAdapter.getTransport()).toBe('rust_ws');

    // Simulate submitRankedResult
    await realtimeMultiplayerAdapter.submitRankedResult('white_win', 'checkmate');
    expect(rustRoomBridge.submitRustRankedResult).toHaveBeenCalledWith('white_win', 'checkmate');

    // Simulate verified_result from Rust WS
    const listenVerifiedCall = vi.mocked(rustRoomBridge.listenRustRankedResultVerified).mock.calls[0][0];
    listenVerifiedCall({ verificationHash: 'hash123', rankedMatchId: 'match1' });
    
    expect(onRankedResultVerified).toHaveBeenCalledWith({ verificationHash: 'hash123', rankedMatchId: 'match1' });
  });

});
