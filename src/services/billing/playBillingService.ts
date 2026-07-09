import { Capacitor } from '@capacitor/core';
import { BILLING_PRODUCTS, PRODUCT_DESCRIPTIONS, PRODUCT_PRICES, PRODUCT_TITLES } from '../../config/products';
import { PlayBillingProduct, PurchaseResult } from '../../types/billingTypes';

// Define window-based interface for custom plugin to prevent TypeScript compilation errors
declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        PlayBilling?: {
          loadProducts(options: { productIds: string[] }): Promise<{ products: PlayBillingProduct[] }>;
          purchaseProduct(options: { productId: string }): Promise<PurchaseResult>;
          restoreActivePurchases(): Promise<{ purchases: { productId: string; purchaseToken: string; orderId?: string }[] }>;
        };
      };
    };
  }
}

export const playBillingService = {
  async loadProducts(productIds: string[]): Promise<PlayBillingProduct[]> {
    if (!Capacitor.isNativePlatform()) {
      // Mock loading in web/browser sandbox
      console.log("[PlayBillingService] Running in web sandbox. Mocking product load.");
      return productIds.map(id => ({
        productId: id,
        title: PRODUCT_TITLES[id] || "Unknown Product",
        description: PRODUCT_DESCRIPTIONS[id] || "",
        price: PRODUCT_PRICES[id] || "₹0",
        type: id === BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY ? 'subs' : 'inapp'
      }));
    }

    try {
      const plugin = window.Capacitor?.Plugins?.PlayBilling;
      if (!plugin) {
        throw new Error("PlayBilling native plugin not registered");
      }
      const res = await plugin.loadProducts({ productIds });
      return res.products;
    } catch (err) {
      console.error("[PlayBillingService] Failed to load products via native plugin:", err);
      throw new Error("Unable to load purchase options. Please try again.");
    }
  },

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (!Capacitor.isNativePlatform()) {
      // Mock sandbox purchase success
      console.log(`[PlayBillingService] Running in web sandbox. Mocking purchase for: ${productId}`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 'success',
            productId,
            purchaseToken: `mock_token_${productId}_${Date.now()}`,
            orderId: `GPA.mock-${Date.now()}`
          });
        }, 1000);
      });
    }

    try {
      const plugin = window.Capacitor?.Plugins?.PlayBilling;
      if (!plugin) {
        throw new Error("PlayBilling native plugin not registered");
      }
      return await plugin.purchaseProduct({ productId });
    } catch (err: any) {
      console.error("[PlayBillingService] Native purchase error:", err);
      return {
        status: 'error',
        productId,
        message: err.message || "Purchase failed. Please try again."
      };
    }
  },

  async restoreActivePurchases(): Promise<{ productId: string; purchaseToken: string; orderId?: string }[]> {
    if (!Capacitor.isNativePlatform()) {
      console.log("[PlayBillingService] Running in web sandbox. Mocking restore purchases.");
      return [];
    }

    try {
      const plugin = window.Capacitor?.Plugins?.PlayBilling;
      if (!plugin) {
        throw new Error("PlayBilling native plugin not registered");
      }
      const res = await plugin.restoreActivePurchases();
      return res.purchases || [];
    } catch (err) {
      console.error("[PlayBillingService] Native restore error:", err);
      throw err;
    }
  }
};
