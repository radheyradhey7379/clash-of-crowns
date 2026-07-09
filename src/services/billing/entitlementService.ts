import { db } from '../../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { BILLING_PRODUCTS } from '../../config/products';
import { Entitlement, UserEntitlements } from '../../types/billingTypes';

export type EntitlementsChangeListener = (entitlements: UserEntitlements) => void;

let currentEntitlements: UserEntitlements = {
  hasPremiumAnalysis: false,
  hasUndoAccess: false,
  premiumExpiresAt: null,
  undoExpiresAt: null
};

let unsubscribe: (() => void) | null = null;
const listeners = new Set<EntitlementsChangeListener>();

function notifyListeners() {
  listeners.forEach(listener => {
    try {
      listener({ ...currentEntitlements });
    } catch (err) {
      console.error("[EntitlementService] Listener error:", err);
    }
  });
}

export const entitlementService = {
  getEntitlements(): UserEntitlements {
    return { ...currentEntitlements };
  },

  registerListener(listener: EntitlementsChangeListener): () => void {
    listeners.add(listener);
    // Emit current state immediately
    listener({ ...currentEntitlements });
    return () => {
      listeners.delete(listener);
    };
  },

  startListening(uid: string): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // Reset entitlements state on new user session start
    currentEntitlements = {
      hasPremiumAnalysis: false,
      hasUndoAccess: false,
      premiumExpiresAt: null,
      undoExpiresAt: null
    };
    notifyListeners();

    try {
      const entitlementsRef = collection(db, 'users', uid, 'entitlements');
      const q = query(entitlementsRef);

      unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Entitlement[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            active: data.active,
            productId: doc.id,
            source: data.source,
            platform: data.platform,
            expiresAt: data.expiresAt,
            entitlementType: data.entitlementType,
            lastVerifiedAt: data.lastVerifiedAt
          });
        });

        const now = Date.now();

        // Calculate Premium Analysis status
        const activePremium = list.find(e => 
          e.productId === BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY && 
          e.active && 
          e.expiresAt > now
        );

        // Calculate Undo passes status
        const activeUndos = list.filter(e => 
          e.productId !== BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY && 
          e.active && 
          e.expiresAt > now
        );

        const maxUndoExpires = activeUndos.length > 0 
          ? Math.max(...activeUndos.map(e => e.expiresAt)) 
          : null;

        currentEntitlements = {
          hasPremiumAnalysis: !!activePremium,
          hasUndoAccess: activeUndos.length > 0,
          premiumExpiresAt: activePremium ? activePremium.expiresAt : null,
          undoExpiresAt: maxUndoExpires
        };

        console.log("[EntitlementService] Entitlements updated:", currentEntitlements);
        notifyListeners();
      }, (err) => {
        console.warn("[EntitlementService] Failed to subscribe to entitlements:", err);
      });
    } catch (err) {
      console.error("[EntitlementService] startListening failed to initialize:", err);
    }
  },

  stopListening(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    currentEntitlements = {
      hasPremiumAnalysis: false,
      hasUndoAccess: false,
      premiumExpiresAt: null,
      undoExpiresAt: null
    };
    notifyListeners();
  }
};
