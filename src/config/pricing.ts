/**
 * src/config/pricing.ts
 * Centralized pricing configuration for Clash of Crowns.
 * Note: These values can be updated from this single file.
 *
 * Updated pricing (July 2026):
 * - Premium Analysis Bundle: ₹149/month (subscription)
 * - Undo Daily Pass: ₹21 (managed product, 24 hours)
 * - Undo Monthly Pass: ₹79 (managed product, 30 days)
 * - Undo Yearly Pass: ₹299 (managed product, 365 days)
 *
 * Premium Analysis Bundle does NOT include undo access.
 * Undo passes are separate standalone products.
 */
export const PRICING_CONFIG = {
  PREMIUM_MONTHLY: 149,
  UNDO_PASS_DAILY: 21,
  UNDO_PASS_MONTHLY: 79,
  UNDO_PASS_YEARLY: 299,
};
