import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Crown, CheckCircle2, Zap, BarChart2, Shield, Video, Activity, Target, Lock, Calendar, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppScreen, PlayerData } from '../../types';
import { useTranslation } from '../../lib/translations';
import { playSound } from '../../lib/sounds';
import { BILLING_PRODUCTS } from '../../config/products';
import { playBillingService } from '../../services/billing/playBillingService';
import { purchaseVerificationService } from '../../services/billing/purchaseVerificationService';
import { UserEntitlements, PlayBillingProduct } from '../../types/billingTypes';
import { auth } from '../../firebase';

interface PremiumScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
  entitlements: UserEntitlements;
}

export default function PremiumScreen({ onNavigate, playerData, entitlements }: PremiumScreenProps) {
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';
  const [selectedUndoPlan, setSelectedUndoPlan] = useState<'day' | 'month' | 'year'>('month');

  // Billing state
  const [products, setProducts] = useState<PlayBillingProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null); // holds product ID being purchased
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    setProductError(null);
    try {
      const productIds = [
        BILLING_PRODUCTS.UNDO_DAILY,
        BILLING_PRODUCTS.UNDO_MONTHLY,
        BILLING_PRODUCTS.UNDO_YEARLY,
        BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY
      ];
      const loaded = await playBillingService.loadProducts(productIds);
      setProducts(loaded);
    } catch (err: any) {
      setProductError(err.message || "Unable to load purchase options. Please try again.");
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleBack = () => {
    playSound('click');
    onNavigate('Home');
  };

  const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  const handlePurchase = async (productId: string) => {
    if (purchaseLoading) return; // Prevent double taps

    playSound('click');

    // Guest user guard
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
      showStatus("Please sign in to save and restore your purchase.", "error");
      return;
    }

    setPurchaseLoading(productId);
    setStatusMessage(null);

    try {
      const result = await playBillingService.purchaseProduct(productId);
      
      if (result.status === 'canceled') {
        showStatus("Purchase cancelled.", "info");
      } else if (result.status === 'pending') {
        showStatus("Purchase pending. Access will unlock after payment is completed.", "info");
      } else if (result.status === 'already_owned') {
        showStatus("You already own this. Restoring access...", "info");
        await handleRestore();
      } else if (result.status === 'success' && result.purchaseToken) {
        showStatus("Verifying purchase with Google...", "info");
        const verifyRes = await purchaseVerificationService.verifyPurchase(productId, result.purchaseToken);
        if (verifyRes.ok && verifyRes.active) {
          showStatus("Purchase successful! Entitlements unlocked.", "success");
        } else {
          showStatus(verifyRes.message || "Purchase verification failed. Please contact support.", "error");
        }
      } else {
        showStatus(result.message || "Purchase failed. Please try again.", "error");
      }
    } catch (err: any) {
      showStatus("Purchase failed. Please try again.", "error");
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleRestore = async () => {
    playSound('click');
    setPurchaseLoading("restore");
    try {
      const activePurchases = await playBillingService.restoreActivePurchases();
      if (activePurchases.length === 0) {
        showStatus("No active purchases found.", "info");
        return;
      }

      showStatus(`Restoring ${activePurchases.length} active purchase(s)...`, "info");
      let restoredCount = 0;
      for (const p of activePurchases) {
        const verifyRes = await purchaseVerificationService.verifyPurchase(p.productId, p.purchaseToken);
        if (verifyRes.ok && verifyRes.active) {
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        showStatus("Purchases restored.", "success");
      } else {
        showStatus("No valid active entitlements verified.", "info");
      }
    } catch (err) {
      showStatus("Failed to restore purchases. Please try again later.", "error");
    } finally {
      setPurchaseLoading(null);
    }
  };

  const formatExpiry = (expiresAt: number | null): string => {
    if (!expiresAt) return "";
    const date = new Date(expiresAt);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getProductPrice = (productId: string, fallback: string): string => {
    const prod = products.find(p => p.productId === productId);
    return prod ? prod.price : fallback;
  };

  const features = [
    { icon: <BarChart2 size={20} />, title: "AI Grandmaster Analysis", desc: "Get deep insights into every move you make." },
    { icon: <Activity size={20} />, title: "Position Evaluation Bar", desc: "Real-time engine evaluation of the current position." },
    { icon: <Target size={20} />, title: "Accuracy % & ACPL Score", desc: "Measure your precision with professional metrics." },
    { icon: <Shield size={20} />, title: "King Safety & Piece Heatmap", desc: "Visualize threats and piece activity on the board." },
    { icon: <Video size={20} />, title: "Video Replay Export", desc: "Export your games as high-quality videos (720p/1080p)." }
  ];

  return (
    <div className="screen-root w-full h-full bg-[#000] relative flex flex-col overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#a855f7] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d9ad33] blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <div 
        className="relative z-10 px-4 py-2 sm:px-6 sm:py-4 md:p-8 flex items-center justify-between flex-shrink-0"
        style={{
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))'
        }}
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          className="p-2 sm:p-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 hover:text-white transition-all"
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
        </motion.button>
        <div className="flex items-center gap-2 sm:gap-3">
          <Crown size={20} className="text-[#d9ad33]" />
          <h1 className="text-base sm:text-xl md:text-2xl font-bold text-[#d9ad33] tracking-[0.2em] font-serif uppercase">PREMIUM</h1>
        </div>
        <button
          onClick={handleRestore}
          disabled={purchaseLoading !== null}
          className="text-xs text-[#d9ad33] hover:underline font-bold uppercase tracking-wider disabled:opacity-50"
        >
          Restore
        </button>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className={cn(
          "mx-4 my-2 p-3 rounded-xl border z-20 text-xs font-bold text-center",
          statusMessage.type === 'success' && "bg-green-500/10 border-green-500/30 text-green-400",
          statusMessage.type === 'error' && "bg-red-500/10 border-red-500/30 text-red-400",
          statusMessage.type === 'info' && "bg-[#d9ad33]/10 border-[#d9ad33]/30 text-[#d9ad33]"
        )}>
          {statusMessage.text}
        </div>
      )}

      {/* Content */}
      <div 
        className="relative z-10 flex-1 overflow-y-auto px-4 md:px-8 pb-12 custom-scrollbar premium-content-area"
        style={{
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 md:mb-12 premium-title-section">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-block p-3 sm:p-4 bg-[#d9ad33]/10 rounded-full mb-4 md:mb-6"
            >
              <Crown size={48} className="text-[#d9ad33] md:w-16 md:h-16" />
            </motion.div>
            <h2 className="text-xl sm:text-3xl md:text-5xl font-bold text-white mb-2 md:mb-4 font-serif tracking-tight">CLASH OF CROWNS PREMIUM</h2>
            <p className="text-white/60 text-sm sm:text-lg max-w-2xl mx-auto">Unlock the full power of AI-driven chess analysis and professional tools.</p>
          </div>

          {isLoadingProducts ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#d9ad33]/60 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent border-[#d9ad33] rounded-full animate-spin" />
              <div className="text-xs uppercase tracking-widest font-bold">Querying Google Play Billing...</div>
            </div>
          ) : productError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-red-950/20 border border-red-500/20 rounded-3xl p-6">
              <AlertCircle size={36} className="text-red-500 mb-3" />
              <p className="text-white/80 font-bold mb-4">{productError}</p>
              <button 
                onClick={fetchProducts}
                className="px-6 py-2.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black font-bold uppercase text-xs tracking-wider rounded-xl transition-all"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
              {/* Premium Bundle Card */}
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-[#1a0d2e] to-[#0d0620] border-2 border-[#a855f7] rounded-3xl p-4 sm:p-6 md:p-8 text-center shadow-[0_0_50px_rgba(168,85,247,0.2)] relative overflow-hidden flex flex-col premium-card-bundle"
              >
                <div className="absolute top-0 right-0 p-3 sm:p-4">
                  <div className="bg-[#a855f7] text-white text-[8px] sm:text-[10px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full tracking-widest uppercase shadow-lg">PRO SUBSCRIPTION</div>
                </div>
                <h3 className="text-[#c084fc] font-serif tracking-[0.3em] uppercase mb-2 sm:mb-4 text-xs sm:text-sm">PREMIUM ANALYSIS</h3>
                
                {entitlements.hasPremiumAnalysis ? (
                  <div className="my-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2 className="text-green-400" size={28} />
                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Active Subscription</span>
                    {entitlements.premiumExpiresAt && (
                      <span className="text-[10px] text-white/50 uppercase tracking-tight">Expires: {formatExpiry(entitlements.premiumExpiresAt)}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                      <span className="text-2xl sm:text-4xl md:text-6xl font-black text-[#f5c518]">{getProductPrice(BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY, "₹149")}</span>
                    </div>
                    <p className="text-white/40 text-[9px] sm:text-sm tracking-widest uppercase mb-4 sm:mb-6">per month</p>
                  </>
                )}

                <div className="flex-1 space-y-3 sm:space-y-4 mb-4 sm:mb-8 text-left">
                  <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-xs sm:text-sm premium-benefit-item">
                    <CheckCircle2 size={14} className="text-[#a855f7] shrink-0" />
                    <span>Full AI Analysis & Evaluation Bar</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-xs sm:text-sm premium-benefit-item">
                    <CheckCircle2 size={14} className="text-[#a855f7] shrink-0" />
                    <span>Mistake, Inaccuracy & Blunder Review</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-xs sm:text-sm premium-benefit-item">
                    <CheckCircle2 size={14} className="text-[#a855f7] shrink-0" />
                    <span>Move-by-Move Suggestion & Details</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-xs sm:text-sm premium-benefit-item">
                    <CheckCircle2 size={14} className="text-[#a855f7] shrink-0" />
                    <span>Detailed King Safety Heatmaps & Stats</span>
                  </div>
                </div>

                {!entitlements.hasPremiumAnalysis && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={purchaseLoading !== null}
                    onClick={() => handlePurchase(BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY)}
                    className="w-full py-3 sm:py-4 bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-black tracking-[0.2em] rounded-xl sm:rounded-2xl shadow-xl hover:brightness-110 disabled:opacity-50 transition-all uppercase text-[9px] sm:text-sm"
                  >
                    {purchaseLoading === BILLING_PRODUCTS.PREMIUM_ANALYSIS_MONTHLY ? "Processing..." : "Get Analysis Bundle"}
                  </motion.button>
                )}
              </motion.div>

              {/* Standalone Undo Card */}
              <motion.div
                whileHover={{ y: -5 }}
                className="bg-gradient-to-br from-[#1a1608] to-[#0d0a02] border-2 border-[#d9ad33]/40 rounded-3xl p-3.5 sm:p-6 md:p-8 text-center shadow-[0_0_50px_rgba(217,173,51,0.1)] flex flex-col relative overflow-hidden premium-card-standalone"
              >
                <div className="absolute top-0 right-0 p-3">
                  <div className="bg-[#d9ad33] text-black text-[8px] sm:text-[10px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full tracking-widest uppercase shadow-lg">MANAGED PRODUCT</div>
                </div>
                <h3 className="text-[#d9ad33] font-serif tracking-[0.3em] uppercase mb-1.5 sm:mb-4 text-xs sm:text-sm">UNDO PASS</h3>
                
                {entitlements.hasUndoAccess ? (
                  <div className="my-4 p-4 bg-[#d9ad33]/15 border border-[#d9ad33]/30 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                    <Zap className="text-[#d9ad33] animate-pulse" size={28} />
                    <span className="text-xs font-bold text-[#d9ad33] uppercase tracking-widest">Active Undo Pass</span>
                    {entitlements.undoExpiresAt && (
                      <span className="text-[10px] text-white/50 uppercase tracking-tight">Expires: {formatExpiry(entitlements.undoExpiresAt)}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 mb-3 sm:mb-6">
                    <Zap size={18} className="text-[#d9ad33]" />
                    <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest">Unlimited Undos</span>
                  </div>
                )}

                <div className="flex-1 space-y-2 sm:space-y-4 mb-4 sm:mb-8">
                  <button 
                    disabled={entitlements.hasUndoAccess || purchaseLoading !== null}
                    onClick={() => { playSound('click'); setSelectedUndoPlan('day'); }}
                    className={cn(
                      "w-full p-2.5 sm:p-4 border rounded-xl sm:rounded-2xl flex items-center justify-between transition-all disabled:opacity-50",
                      selectedUndoPlan === 'day' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Clock size={16} className={selectedUndoPlan === 'day' ? "text-[#d9ad33]" : "text-white/40"} />
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-bold text-white">Daily Pass</div>
                        <div className="text-[8px] sm:text-[10px] text-white/40 uppercase">24 Hours Access</div>
                      </div>
                    </div>
                    <span className="text-sm sm:text-lg font-black text-[#f5c518]">{getProductPrice(BILLING_PRODUCTS.UNDO_DAILY, "₹21")}</span>
                  </button>

                  <button 
                    disabled={entitlements.hasUndoAccess || purchaseLoading !== null}
                    onClick={() => { playSound('click'); setSelectedUndoPlan('month'); }}
                    className={cn(
                      "w-full p-2.5 sm:p-4 border rounded-xl sm:rounded-2xl flex items-center justify-between transition-all disabled:opacity-50",
                      selectedUndoPlan === 'month' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar size={16} className={selectedUndoPlan === 'month' ? "text-[#d9ad33]" : "text-white/40"} />
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-bold text-white">Monthly Pass</div>
                        <div className="text-[8px] sm:text-[10px] text-white/40 uppercase">30 Days Access</div>
                      </div>
                    </div>
                    <span className="text-sm sm:text-lg font-black text-[#f5c518]">{getProductPrice(BILLING_PRODUCTS.UNDO_MONTHLY, "₹79")}</span>
                  </button>

                  <button 
                    disabled={entitlements.hasUndoAccess || purchaseLoading !== null}
                    onClick={() => { playSound('click'); setSelectedUndoPlan('year'); }}
                    className={cn(
                      "w-full p-2.5 sm:p-4 border rounded-xl sm:rounded-2xl flex items-center justify-between transition-all disabled:opacity-50",
                      selectedUndoPlan === 'year' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Crown size={16} className={selectedUndoPlan === 'year' ? "text-[#d9ad33]" : "text-white/40"} />
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-bold text-white">Yearly Pass</div>
                        <div className="text-[8px] sm:text-[10px] text-white/40 uppercase">365 Days Access</div>
                      </div>
                    </div>
                    <span className="text-sm sm:text-lg font-black text-[#f5c518]">{getProductPrice(BILLING_PRODUCTS.UNDO_YEARLY, "₹299")}</span>
                  </button>
                </div>

                {!entitlements.hasUndoAccess && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={purchaseLoading !== null}
                    onClick={() => {
                      const id = selectedUndoPlan === 'day' ? BILLING_PRODUCTS.UNDO_DAILY :
                                 selectedUndoPlan === 'month' ? BILLING_PRODUCTS.UNDO_MONTHLY :
                                 BILLING_PRODUCTS.UNDO_YEARLY;
                      handlePurchase(id);
                    }}
                    className="w-full py-3 sm:py-4 bg-[#d9ad33] text-black font-black tracking-[0.2em] rounded-xl sm:rounded-2xl shadow-xl hover:bg-[#f5d666] disabled:opacity-50 transition-all uppercase text-[9px] sm:text-sm"
                  >
                    {purchaseLoading === BILLING_PRODUCTS.UNDO_DAILY || purchaseLoading === BILLING_PRODUCTS.UNDO_MONTHLY || purchaseLoading === BILLING_PRODUCTS.UNDO_YEARLY ? "Processing..." : "Buy Undo Pass"}
                  </motion.button>
                )}
              </motion.div>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all group"
              >
                <div className="w-12 h-12 bg-[#d9ad33]/10 rounded-xl flex items-center justify-center text-[#d9ad33] mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h4 className="text-white font-bold mb-2 tracking-wide">{f.title}</h4>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Footer Terms Disclaimers */}
          <div className="text-center mt-16 text-[9px] sm:text-xs text-white/30 space-y-2">
            <p>Payments are securely processed by Google Play. Standalone passes and subscriptions are bound to your account and can be restored at any time.</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => { playSound('click'); onNavigate('TermsOfService'); }} className="hover:text-white underline">Terms of Service</button>
              <button onClick={() => { playSound('click'); onNavigate('PrivacyPolicy'); }} className="hover:text-white underline">Privacy Policy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
