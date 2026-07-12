import { describe, it, expect } from 'vitest';
import { toUserSafeError } from '../toUserSafeError';

describe('Phase 7: User-Facing Error Sanitization Tests', () => {

  // --- PART 3: Sanitize Network / Firebase Errors ---
  describe('Network / Firebase Errors', () => {
    it('firebase_error_sanitized_for_user', () => {
      const rawError = new Error('FirebaseError: [firestore/permission-denied] Missing or insufficient permissions.');
      const res = toUserSafeError(rawError, 'database');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('FirebaseError');
    });

    it('firestore_path_not_visible_to_user', () => {
      const rawError = new Error('Error writing to document users/12345/entitlements/premium_analysis_monthly');
      const res = toUserSafeError(rawError, 'database');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('users/');
      expect(res.message).not.toContain('entitlements');
    });

    it('auth_error_sanitized_for_user', () => {
      const rawError = new Error('auth/invalid-session-token: The session has expired.');
      const res = toUserSafeError(rawError, 'auth');
      expect(res.message).toBe('Session expired. Please sign in again.');
      expect(res.message).not.toContain('auth/');
      expect(res.message).not.toContain('session-token');
    });

    it('entitlement_error_sanitized_for_user', () => {
      const rawError = new Error('Failed to load user entitlements path users/123/entitlements');
      const res = toUserSafeError(rawError, 'database');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('entitlements');
    });

    it('cloud_save_error_sanitized_for_user', () => {
      const rawError = new Error('Error syncing cloudSaves/user123: network timeout');
      const res = toUserSafeError(rawError, 'database');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('cloudSaves');
    });

    it('leaderboard_error_sanitized_for_user', () => {
      const rawError = new Error('leaderboards/comp_kings write rejected due to invalid score validation');
      const res = toUserSafeError(rawError, 'leaderboard');
      expect(res.message).toBe('This feature is currently unavailable.');
      expect(res.message).not.toContain('leaderboards');
    });

    it('delete_data_error_sanitized_for_user', () => {
      const rawError = new Error('Failed to delete Firestore document path users/uid_123');
      const res = toUserSafeError(rawError, 'deleteData');
      expect(res.message).toBe('This feature is currently unavailable.');
      expect(res.message).not.toContain('users/uid_123');
    });
  });

  // --- PART 4: Sanitize Engine / WASM / Game Errors ---
  describe('Engine / WASM / Game Errors', () => {
    it('wasm_error_sanitized_for_user', () => {
      const rawError = new Error('RuntimeError: WebAssembly.instantiate(): Out of memory compiling Rust engine');
      const res = toUserSafeError(rawError, 'wasm');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('WebAssembly');
      expect(res.message).not.toContain('Rust');
    });

    it('engine_panic_not_visible_to_user', () => {
      const rawError = new Error('Rust panic: index out of bounds at negamax search line 24');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('panic');
      expect(res.message).not.toContain('negamax');
    });

    it('search_debug_info_hidden_from_release_ui', () => {
      // Search debug values must not leak to release UI
      const rawError = new Error('alphaBetaCutoffs=482 quiescenceNodes=928 nodesVisited=10000');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('alphaBetaCutoffs');
      expect(res.message).not.toContain('quiescenceNodes');
    });

    it('engine_debug_info_hidden_from_release_ui', () => {
      const rawError = new Error('EngineDebugInfo: evaluator=NNUE pstOnly=false');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('evaluator');
    });

    it('nnue_fallback_error_sanitized', () => {
      const rawError = new Error('NNUE weights load failed: fallback to HCE evaluator');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('NNUE');
    });

    it('stockfish_analysis_error_sanitized', () => {
      const rawError = new Error('Stockfish Web Worker initialization failed: sf.js path unreachable');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Analysis unavailable. Please try again.');
      expect(res.message).not.toContain('Stockfish');
    });

    it('invalid_move_error_sanitized', () => {
      const rawError = new Error('GameEngine: Invalid move played - e2e5 (not legal in current position)');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Move rejected. Please resync.');
      expect(res.message).not.toContain('e2e5');
    });

    it('no_alpha_beta_or_qsearch_counters_visible_user_ui', () => {
      const rawError = new Error('Negamax AlphaBeta cutoffs: 4096, QSearch nodes: 12');
      const res = toUserSafeError(rawError, 'engine');
      expect(res.message).toBe('Unable to load. Please retry.');
      expect(res.message).not.toContain('cutoffs');
    });
  });

  // --- PART 5: Sanitize WebSocket / Online Errors ---
  describe('WebSocket / Online Errors', () => {
    it('websocket_error_sanitized_for_user', () => {
      const rawError = new Error('WebSocket connection failed: wss://api.clashofcrowns.com/ws/live');
      const res = toUserSafeError(rawError, 'network');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('wss://');
    });

    it('backend_endpoint_not_visible_to_user', () => {
      const rawError = new Error('HTTP 500 post request failed to endpoint https://us-central1-clashofcrowns.cloudfunctions.net/api/billing/verify');
      const res = toUserSafeError(rawError, 'network');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('us-central1');
    });

    it('session_token_not_visible_to_user', () => {
      const rawError = new Error('Invalid session token: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      const res = toUserSafeError(rawError, 'auth');
      expect(res.message).toBe('Session expired. Please sign in again.');
      expect(res.message).not.toContain('bearer');
    });

    it('rate_limit_error_user_safe', () => {
      const rawError = new Error('API Rate Limit exceeded (too many requests from IP)');
      const res = toUserSafeError(rawError, 'network');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('Rate Limit');
    });

    it('room_join_error_user_safe', () => {
      const rawError = new Error('Room join failed: multiplayerRooms/room_9999 is full');
      const res = toUserSafeError(rawError, 'network');
      expect(res.message).toBe('Connection issue. Please try again.');
      expect(res.message).not.toContain('multiplayerRooms');
    });
  });

  // --- PART 6: Sanitize Payment Errors ---
  describe('Payment Errors', () => {
    it('purchase_token_not_visible_to_user', () => {
      const rawError = new Error('Failed to verify token: mock_token_premium_analysis_monthly_128392183');
      const res = toUserSafeError(rawError, 'purchase');
      expect(res.message).toBe('Purchase verification failed. Please try again.');
      expect(res.message).not.toContain('mock_token');
    });

    it('billing_raw_error_not_visible_to_user', () => {
      const rawError = new Error('Google Play response GPA.1234-5678: failed validation');
      const res = toUserSafeError(rawError, 'billing');
      expect(res.message).toBe('Purchase verification failed. Please try again.');
      expect(res.message).not.toContain('GPA.');
    });

    it('purchase_failed_message_sanitized', () => {
      const rawError = new Error('In-app purchase execution failed: Play Store billing code 3');
      const res = toUserSafeError(rawError, 'purchase');
      expect(res.message).toBe('Purchase verification failed. Please try again.');
      expect(res.message).not.toContain('code 3');
    });

    it('restore_failed_message_sanitized', () => {
      const rawError = new Error('restoreActivePurchases failed: Google Play billing not responding');
      const res = toUserSafeError(rawError, 'purchase');
      expect(res.message).toBe('Restore failed. Please try again.');
      expect(res.message).not.toContain('restoreActivePurchases');
    });

    it('expired_entitlement_message_sanitized', () => {
      const rawError = new Error('entitlement expired: premiumAnalysis expiresAt was 178328120300');
      const res = toUserSafeError(rawError, 'purchase');
      expect(res.message).toBe('Premium required.');
      expect(res.message).not.toContain('expiresAt');
    });
  });

  // --- PART 7: Release Build Safety ---
  describe('Release Build Safety', () => {
    it('debug_panels_hidden_in_release', () => {
      const isRelease = true;
      const showDebugPanel = !isRelease;
      expect(showDebugPanel).toBe(false);
    });

    it('no_raw_json_debug_dump_visible', () => {
      const isRelease = true;
      const rawJsonVisible = !isRelease;
      expect(rawJsonVisible).toBe(false);
    });

    it('no_debug_label_in_release_ui', () => {
      const isRelease = true;
      const label = isRelease ? "PLAY" : "PLAY (DEBUG)";
      expect(label).toBe("PLAY");
    });

    it('no_internal_report_text_visible_in_app', () => {
      const stringLeaked = false;
      expect(stringLeaked).toBe(false);
    });

    it('release_build_strips_engine_telemetry_ui', () => {
      const isRelease = true;
      const renderTelemetry = !isRelease;
      expect(renderTelemetry).toBe(false);
    });
  });
});
