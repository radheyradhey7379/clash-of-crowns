import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentAppVersion, compareVersions, isVersionBelow } from '../appVersion';
import { evaluateVersionGate, checkVersionGate } from '../versionGateService';
import { VersionGateConfig } from '../versionGateTypes';
import { DEFAULT_VERSION_CONFIG } from '../defaultVersionConfig';
import { 
  isFeatureAvailable, 
  getFeatureUnavailableReason, 
  setRemoteVersionConfig, 
  setNodeHealth, 
  setRustHealth, 
  resetStartupTime 
} from '../../config/featureAvailability';

let mockUser: any = { uid: 'user_123' };
let mockIsFirebaseConfigured = true;

vi.mock('../../firebase', () => ({
  auth: {
    get currentUser() {
      return mockUser;
    }
  },
  get isFirebaseConfigured() {
    return mockIsFirebaseConfigured;
  }
}));

// Mock featureFlags to control local flags in tests
vi.mock('../../config/featureFlags', () => ({
  isMultiplayerEnabled: vi.fn().mockReturnValue(true),
  isRustRealtimeEnabled: vi.fn().mockReturnValue(true),
  isRankedArenaEnabled: vi.fn().mockReturnValue(true),
  isSocialPokeEnabled: vi.fn().mockReturnValue(true),
  isChallengeMatchEnabled: vi.fn().mockReturnValue(true),
  isTournamentsEnabled: vi.fn().mockReturnValue(true),
}));

import * as featureFlags from '../../config/featureFlags';

describe('Version Gate System (Phase 31B)', () => {
  describe('appVersion helper', () => {
    it('compareVersions correctly evaluates semantics', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('isVersionBelow correctly evaluates', () => {
      expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
      expect(isVersionBelow('1.0.1', '1.0.0')).toBe(false);
      expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('evaluateVersionGate decision logic', () => {
    let baseConfig: VersionGateConfig;

    beforeEach(() => {
      vi.stubEnv('VITE_APP_VERSION', '1.0.0');
      baseConfig = { ...DEFAULT_VERSION_CONFIG };
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns maintenance when maintenanceMode is true', () => {
      baseConfig.maintenanceMode = true;
      expect(evaluateVersionGate(baseConfig)).toBe('maintenance');
    });

    it('returns force_update when forceUpdate flag is true', () => {
      baseConfig.forceUpdate = true;
      expect(evaluateVersionGate(baseConfig)).toBe('force_update');
    });

    it('returns force_update when current version < minimumSupportedVersion', () => {
      baseConfig.minimumSupportedVersion = '1.0.1';
      expect(evaluateVersionGate(baseConfig)).toBe('force_update');
    });

    it('returns soft_update when latestVersion > current version but minimum satisfied', () => {
      baseConfig.minimumSupportedVersion = '1.0.0';
      baseConfig.latestVersion = '1.0.1';
      expect(evaluateVersionGate(baseConfig)).toBe('soft_update');
    });

    it('returns allowed when current version meets requirements', () => {
      baseConfig.minimumSupportedVersion = '1.0.0';
      baseConfig.latestVersion = '1.0.0';
      expect(evaluateVersionGate(baseConfig)).toBe('allowed');
    });
  });

  describe('featureAvailability resolver', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      setRemoteVersionConfig({ ...DEFAULT_VERSION_CONFIG });
      resetStartupTime();
      setNodeHealth('healthy');
      setRustHealth('healthy');
    });

    it('disables feature if local env flag is false', () => {
      // Local false
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(false);
      
      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true }; // Remote true
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(false);
    });

    it('enables feature only if BOTH local and remote allow it', () => {
      // Local true
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      
      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] }; // Remote true
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(true);
    });

    it('disables feature if explicitly listed in disabledFeatures array', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      
      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: ['multiplayer'] };
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(false);
    });

    it('disables all features if in maintenanceMode', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      
      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, maintenanceMode: true };
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(false);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('Maintenance');
    });

    it('enables Casual/Friend multiplayer when local flags are true and backend is healthy', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRustRealtimeEnabled).mockReturnValue(true);
      mockUser = { uid: 'user_123' };
      mockIsFirebaseConfigured = true;
      setNodeHealth('healthy');
      setRustHealth('healthy');

      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] };
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(true);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('');
    });

    it('does not disable Casual/Friend when ranked or tournament flags are false', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRustRealtimeEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRankedArenaEnabled).mockReturnValue(false);
      vi.mocked(featureFlags.isTournamentsEnabled).mockReturnValue(false);
      mockUser = { uid: 'user_123' };
      mockIsFirebaseConfigured = true;
      setNodeHealth('healthy');
      setRustHealth('healthy');

      const config = { ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] };
      setRemoteVersionConfig(config);

      expect(isFeatureAvailable('multiplayer')).toBe(true);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('');
    });

    it('disables multiplayer with Backend unavailable when health checks fail', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRustRealtimeEnabled).mockReturnValue(true);
      mockUser = { uid: 'user_123' };
      mockIsFirebaseConfigured = true;
      setRemoteVersionConfig({ ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] });
      
      // Node failed
      setNodeHealth('failed');
      setRustHealth('healthy');
      expect(isFeatureAvailable('multiplayer')).toBe(false);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('Backend unavailable');

      // Rust failed
      setNodeHealth('healthy');
      setRustHealth('failed');
      expect(isFeatureAvailable('multiplayer')).toBe(false);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('Backend unavailable');
    });

    it('disables multiplayer with Login required when auth is missing and Firebase is configured', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRustRealtimeEnabled).mockReturnValue(true);
      mockUser = null; // Missing auth
      mockIsFirebaseConfigured = true; // Firebase configured
      setNodeHealth('healthy');
      setRustHealth('healthy');
      setRemoteVersionConfig({ ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] });

      expect(isFeatureAvailable('multiplayer')).toBe(false);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('Login required');
    });

    it('allows guest to test Casual/Friend Match when Google login is unavailable (Firebase not configured)', () => {
      vi.mocked(featureFlags.isMultiplayerEnabled).mockReturnValue(true);
      vi.mocked(featureFlags.isRustRealtimeEnabled).mockReturnValue(true);
      mockUser = null; // No user logged in
      mockIsFirebaseConfigured = false; // Firebase not configured
      setNodeHealth('healthy');
      setRustHealth('healthy');
      setRemoteVersionConfig({ ...DEFAULT_VERSION_CONFIG, multiplayerEnabled: true, disabledFeatures: [] });

      expect(isFeatureAvailable('multiplayer')).toBe(true);
      expect(getFeatureUnavailableReason('multiplayer')).toBe('');
    });
  });
});
