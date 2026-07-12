export const BILLING_PRODUCTS = {
  UNDO_DAILY: "undo_daily_pass",
  UNDO_MONTHLY: "undo_monthly_pass",
  UNDO_YEARLY: "undo_yearly_pass",
  PREMIUM_ANALYSIS_MONTHLY: "premium_analysis_monthly",
  PREMIUM_UNDO_ADDON: "premium_undo_addon_monthly",
} as const;

export const PRODUCT_TITLES: Record<string, string> = {
  [BILLING_PRODUCTS.UNDO_DAILY]: "Undo Daily Pass",
  [BILLING_PRODUCTS.UNDO_MONTHLY]: "Undo Monthly Pass",
  [BILLING_PRODUCTS.UNDO_YEARLY]: "Undo Yearly Pass",
  [BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY]: "Premium Access",
  [BILLING_PRODUCTS.PREMIUM_UNDO_ADDON]: "Unlimited Undo Add-on",
};

export const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  [BILLING_PRODUCTS.UNDO_DAILY]: "Get unlimited undos for 24 hours in all matches.",
  [BILLING_PRODUCTS.UNDO_MONTHLY]: "Get unlimited undos for 30 days in all matches.",
  [BILLING_PRODUCTS.UNDO_YEARLY]: "Get unlimited undos for 365 days in all matches.",
  [BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY]: "Unlock deep AI move-by-move match reviews, position evaluations, safety/heatmaps and premium stats.",
  [BILLING_PRODUCTS.PREMIUM_UNDO_ADDON]: "Add unlimited undos to your premium subscription.",
};

export const PRODUCT_PRICES: Record<string, string> = {
  [BILLING_PRODUCTS.UNDO_DAILY]: "₹21",
  [BILLING_PRODUCTS.UNDO_MONTHLY]: "₹79",
  [BILLING_PRODUCTS.UNDO_YEARLY]: "₹299",
  [BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY]: "₹349",
  [BILLING_PRODUCTS.PREMIUM_UNDO_ADDON]: "₹149",
};
