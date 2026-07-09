import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { entitlementService } from '../entitlementService';
import { BILLING_PRODUCTS } from '../../../config/products';

// Mock Firebase dependencies
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  onSnapshot: vi.fn((q, callback) => {
    mockOnSnapshot(callback);
    return () => {};
  })
}));

vi.mock('../../../firebase', () => ({
  db: {}
}));

describe('Entitlements Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entitlementService.stopListening();
  });

  afterEach(() => {
    entitlementService.stopListening();
  });

  it('should initialize with no entitlements active', () => {
    const ents = entitlementService.getEntitlements();
    expect(ents.hasPremiumAnalysis).toBe(false);
    expect(ents.hasUndoAccess).toBe(false);
    expect(ents.premiumExpiresAt).toBeNull();
    expect(ents.undoExpiresAt).toBeNull();
  });

  it('should trigger registered listeners when snapshot updates active subscriptions', () => {
    let calledEnts: any = null;
    const listener = vi.fn(ents => {
      calledEnts = ents;
    });

    entitlementService.registerListener(listener);
    expect(listener).toHaveBeenCalled();

    // Start listening
    entitlementService.startListening('test-uid');

    // Simulate snapshot emission
    const mockDocs = [
      {
        id: BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY,
        data: () => ({
          active: true,
          source: 'google_play',
          platform: 'android',
          expiresAt: Date.now() + 100000,
          entitlementType: 'premium_analysis',
          lastVerifiedAt: Date.now()
        })
      }
    ];

    // Trigger mock snapshot callback
    const snapshotCallback = mockOnSnapshot.mock.calls[0][0];
    snapshotCallback(mockDocs);

    expect(calledEnts.hasPremiumAnalysis).toBe(true);
    expect(calledEnts.hasUndoAccess).toBe(false);
    expect(calledEnts.premiumExpiresAt).toBeGreaterThan(Date.now());
  });

  it('should trigger registered listeners when snapshot updates active undo passes', () => {
    let calledEnts: any = null;
    const listener = vi.fn(ents => {
      calledEnts = ents;
    });

    entitlementService.registerListener(listener);
    entitlementService.startListening('test-uid');

    const now = Date.now();
    const mockDocs = [
      {
        id: BILLING_PRODUCTS.UNDO_DAILY,
        data: () => ({
          active: true,
          source: 'google_play',
          platform: 'android',
          expiresAt: now + 50000,
          entitlementType: 'undo',
          lastVerifiedAt: now
        })
      }
    ];

    const snapshotCallback = mockOnSnapshot.mock.calls[0][0];
    snapshotCallback(mockDocs);

    expect(calledEnts.hasPremiumAnalysis).toBe(false);
    expect(calledEnts.hasUndoAccess).toBe(true);
    expect(calledEnts.undoExpiresAt).toBe(now + 50000);
  });

  it('should ignore expired passes or subscriptions', () => {
    let calledEnts: any = null;
    const listener = vi.fn(ents => {
      calledEnts = ents;
    });

    entitlementService.registerListener(listener);
    entitlementService.startListening('test-uid');

    const pastTime = Date.now() - 5000;
    const mockDocs = [
      {
        id: BILLING_PRODUCTS.UNDO_DAILY,
        data: () => ({
          active: true,
          source: 'google_play',
          platform: 'android',
          expiresAt: pastTime,
          entitlementType: 'undo',
          lastVerifiedAt: pastTime
        })
      }
    ];

    const snapshotCallback = mockOnSnapshot.mock.calls[0][0];
    snapshotCallback(mockDocs);

    expect(calledEnts.hasPremiumAnalysis).toBe(false);
    expect(calledEnts.hasUndoAccess).toBe(false);
    expect(calledEnts.undoExpiresAt).toBeNull();
  });
});
