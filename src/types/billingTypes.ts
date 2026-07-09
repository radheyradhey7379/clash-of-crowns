export interface PlayBillingProduct {
  productId: string;
  title: string;
  description: string;
  price: string; // e.g. "₹149" or "₹21"
  type: 'inapp' | 'subs';
}

export type PurchaseResultStatus = 'success' | 'canceled' | 'pending' | 'already_owned' | 'error';

export interface PurchaseResult {
  status: PurchaseResultStatus;
  productId: string;
  purchaseToken?: string;
  orderId?: string;
  message?: string;
}

export interface Entitlement {
  active: boolean;
  productId: string;
  source: 'google_play' | 'mock';
  platform: 'android' | 'web';
  expiresAt: number;
  entitlementType: 'undo' | 'premium_analysis';
  lastVerifiedAt: number;
}

export interface UserEntitlements {
  hasPremiumAnalysis: boolean;
  hasUndoAccess: boolean;
  premiumExpiresAt: number | null;
  undoExpiresAt: number | null;
}
