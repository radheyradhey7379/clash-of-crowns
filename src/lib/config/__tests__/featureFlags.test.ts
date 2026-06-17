import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isMultiplayerEnabled,
  isRustRealtimeEnabled,
  isRankedArenaEnabled,
  isSocialPokeEnabled,
  isChallengeMatchEnabled,
  isTournamentsEnabled,
  getDisabledFeatureMessage
} from '../featureFlags';

describe('Feature Flags (v1.0)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return correct boolean values based on env vars', () => {
    vi.stubEnv('VITE_ENABLE_MULTIPLAYER', 'false');
    vi.stubEnv('VITE_ENABLE_RUST_REALTIME', 'false');
    vi.stubEnv('VITE_ENABLE_RANKED_ARENA', 'false');
    vi.stubEnv('VITE_ENABLE_SOCIAL_POKE', 'true');
    vi.stubEnv('VITE_ENABLE_CHALLENGE_MATCH', 'false');
    vi.stubEnv('VITE_ENABLE_TOURNAMENTS', 'false');

    expect(isMultiplayerEnabled()).toBe(false);
    expect(isRustRealtimeEnabled()).toBe(false);
    expect(isRankedArenaEnabled()).toBe(false);
    expect(isSocialPokeEnabled()).toBe(true);
    expect(isChallengeMatchEnabled()).toBe(false);
    expect(isTournamentsEnabled()).toBe(false);
  });

  it('should fall back to safe defaults if env vars are missing', () => {
    // Note: vitest environment might have some vars set.
    // We can clear them for this test.
    vi.stubEnv('VITE_ENABLE_MULTIPLAYER', '');
    vi.stubEnv('VITE_ENABLE_RUST_REALTIME', '');
    vi.stubEnv('VITE_ENABLE_RANKED_ARENA', '');
    vi.stubEnv('VITE_ENABLE_SOCIAL_POKE', '');
    vi.stubEnv('VITE_ENABLE_CHALLENGE_MATCH', '');
    vi.stubEnv('VITE_ENABLE_TOURNAMENTS', '');

    expect(isMultiplayerEnabled()).toBe(false);
    expect(isRustRealtimeEnabled()).toBe(false);
    expect(isRankedArenaEnabled()).toBe(false);
    expect(isSocialPokeEnabled()).toBe(true); // default true
    expect(isChallengeMatchEnabled()).toBe(false);
    expect(isTournamentsEnabled()).toBe(false);
  });

  it('should return correct disabled messages', () => {
    expect(getDisabledFeatureMessage('multiplayer')).toContain('Coming Soon');
    expect(getDisabledFeatureMessage('ranked')).toContain('Coming Soon');
    expect(getDisabledFeatureMessage('tournament')).toContain('Coming Soon');
    expect(getDisabledFeatureMessage('challenge')).toContain('Coming Soon');
  });
});
