import { getApiUrl } from '../apiClient';
import { auth } from '../../firebase';

export interface VerificationResponse {
  ok: boolean;
  productId?: string;
  active?: boolean;
  entitlementType?: 'undo' | 'premium_analysis';
  expiresAt?: number;
  errorCode?: string;
  message?: string;
}

export const purchaseVerificationService = {
  async verifyPurchase(
    productId: string,
    purchaseToken: string,
    packageName: string = 'com.clashofcrowns.game'
  ): Promise<VerificationResponse> {
    const user = auth.currentUser;
    if (!user) {
      return {
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'You must be signed in to purchase and verify products.'
      };
    }

    try {
      const idToken = await user.getIdToken();
      
      const response = await fetch(getApiUrl('/api/billing/verify'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          purchaseToken,
          platform: 'android',
          packageName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          errorCode: errorData.errorCode || 'VERIFICATION_FAILED',
          message: errorData.message || 'Purchase verification failed on the server.'
        };
      }

      return await response.json();
    } catch (err: any) {
      console.error("[PurchaseVerificationService] Verification error:", err);
      return {
        ok: false,
        errorCode: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection and try again.'
      };
    }
  }
};
