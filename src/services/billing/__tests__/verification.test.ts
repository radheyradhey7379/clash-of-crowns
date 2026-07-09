import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseVerificationService } from '../purchaseVerificationService';

vi.mock('../../../firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve('mock-firebase-id-token')
    }
  }
}));

// Mock apiClient
vi.mock('../apiClient', () => ({
  getApiUrl: (path: string) => `http://localhost:3000${path}`
}));

describe('Purchase Verification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should send purchase verification payload successfully and return result', async () => {
    const mockResponse = {
      ok: true,
      productId: 'premium_analysis_monthly',
      active: true,
      entitlementType: 'premium_analysis',
      expiresAt: 1790000000000
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as any);

    const res = await purchaseVerificationService.verifyPurchase('premium_analysis_monthly', 'mock-purchase-token');

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/billing/verify', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-firebase-id-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        productId: 'premium_analysis_monthly',
        purchaseToken: 'mock-purchase-token',
        platform: 'android',
        packageName: 'com.clashofcrowns.game'
      })
    });

    expect(res.ok).toBe(true);
    expect(res.active).toBe(true);
    expect(res.productId).toBe('premium_analysis_monthly');
  });

  it('should return error response if server returns non-ok status code', async () => {
    const mockErr = {
      errorCode: 'INVALID_PURCHASE_TOKEN',
      message: 'Token verification failed.'
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(mockErr)
    } as any);

    const res = await purchaseVerificationService.verifyPurchase('premium_analysis_monthly', 'bad-token');
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('INVALID_PURCHASE_TOKEN');
  });
});
