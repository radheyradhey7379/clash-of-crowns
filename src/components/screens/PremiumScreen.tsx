import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Crown, CheckCircle2, Zap, BarChart2, Shield, Video, Activity, Target, Lock, Calendar, Clock } from 'lucide-react';
import { downloadElement, cn } from '../../lib/utils';
import { AppScreen, PlayerData } from '../../types';
import { useTranslation } from '../../lib/translations';
import { playSound } from '../../lib/sounds';
import { PRICING_CONFIG } from '../../config/pricing';

interface PremiumScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

export default function PremiumScreen({ onNavigate, playerData }: PremiumScreenProps) {
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';
  const [includeUndo, setIncludeUndo] = useState(false);
  const [selectedUndoPlan, setSelectedUndoPlan] = useState<'day' | 'month' | 'year'>('month');

  const handleBack = () => {
    playSound('click');
    onNavigate('Home');
  };

  const handleUpgradePremium = () => {
    playSound('click');
    const total = includeUndo 
      ? (PRICING_CONFIG.PREMIUM_MONTHLY + PRICING_CONFIG.UNDO_ADDON_MONTHLY) 
      : PRICING_CONFIG.PREMIUM_MONTHLY;
    alert(`Redirecting to secure payment gateway for ₹${total} Monthly Plan ${includeUndo ? '(with Undo Add-on)' : ''}...`);
  };

  const handleBuyUndoStandalone = (plan: 'day' | 'month' | 'year') => {
    playSound('click');
    const prices = { 
      day: PRICING_CONFIG.UNDO_PASS_DAILY, 
      month: PRICING_CONFIG.UNDO_PASS_MONTHLY, 
      year: PRICING_CONFIG.UNDO_PASS_YEARLY 
    };
    const labels = { day: 'Daily', month: 'Monthly', year: 'Yearly' };
    alert(`Redirecting to secure payment gateway for ₹${prices[plan]} ${labels[plan]} Undo Plan...`);
  };

  const features = [
    { icon: <BarChart2 size={20} />, title: "AI Grandmaster Analysis", desc: "Get deep insights into every move you make." },
    { icon: <Activity size={20} />, title: "Position Evaluation Bar", desc: "Real-time engine evaluation of the current position." },
    { icon: <Target size={20} />, title: "Accuracy % & ACPL Score", desc: "Measure your precision with professional metrics." },
    { icon: <Shield size={20} />, title: "King Safety & Piece Heatmap", desc: "Visualize threats and piece activity on the board." },
    { icon: <Video size={20} />, title: "Video Replay Export", desc: "Export your games as high-quality videos (720p/1080p)." },
    { icon: <Zap size={20} />, title: "Undo Add-on Available", desc: "Get unlimited undos as a standalone or bundle add-on." }
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
        className="relative z-10 px-4 py-2 sm:px-6 sm:py-4 md:p-8 flex items-center justify-between"
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
        <div className="w-10 sm:w-12" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div 
        className="relative z-10 flex-1 overflow-y-auto px-4 md:px-8 pb-12 custom-scrollbar"
        style={{
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6 md:mb-12">
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

          {/* Pricing Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16">
            {/* Premium Bundle Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-[#1a0d2e] to-[#0d0620] border-2 border-[#a855f7] rounded-3xl p-4 sm:p-6 md:p-8 text-center shadow-[0_0_50px_rgba(168,85,247,0.2)] relative overflow-hidden flex flex-col"
            >
              <div className="absolute top-0 right-0 p-3 sm:p-4">
                <div className="bg-[#a855f7] text-white text-[8px] sm:text-[10px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full tracking-widest uppercase shadow-lg">PRO BUNDLE</div>
              </div>
              <h3 className="text-[#c084fc] font-serif tracking-[0.3em] uppercase mb-2 sm:mb-4 text-xs sm:text-sm">PREMIUM ACCESS</h3>
              <div className="flex items-center justify-center gap-1 mb-1 sm:mb-2">
                <span className="text-2xl sm:text-4xl md:text-6xl font-black text-[#f5c518]">₹{includeUndo ? (PRICING_CONFIG.PREMIUM_MONTHLY + PRICING_CONFIG.UNDO_ADDON_MONTHLY) : PRICING_CONFIG.PREMIUM_MONTHLY}</span>
              </div>
              <p className="text-white/40 text-[9px] sm:text-sm tracking-widest uppercase mb-4 sm:mb-6">per month</p>
              
              <div className="flex-1 space-y-3 sm:space-y-4 mb-4 sm:mb-8">
                <div className="flex items-center gap-2 sm:gap-3 text-left text-white/80 text-xs sm:text-sm">
                  <CheckCircle2 size={14} className="text-[#a855f7] shrink-0 sm:w-4 sm:h-4" />
                  <span>Full AI Analysis & Evaluation Bar</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-left text-white/80 text-xs sm:text-sm">
                  <CheckCircle2 size={14} className="text-[#a855f7] shrink-0 sm:w-4 sm:h-4" />
                  <span>HD Video Export (1080p)</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-left text-white/80 text-xs sm:text-sm">
                  <CheckCircle2 size={14} className="text-[#a855f7] shrink-0 sm:w-4 sm:h-4" />
                  <span>King Safety & Piece Heatmaps</span>
                </div>
                
                {/* Undo Add-on Toggle */}
                <div 
                  onClick={() => {
                    playSound('click');
                    setIncludeUndo(!includeUndo);
                  }}
                  className={`mt-4 p-2.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${includeUndo ? 'border-[#f5c518] bg-[#f5c518]/10' : 'border-white/10 bg-white/5'}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md border-2 flex items-center justify-center transition-all ${includeUndo ? 'bg-[#f5c518] border-[#f5c518]' : 'border-white/20'}`}>
                      {includeUndo && <CheckCircle2 size={12} className="text-black sm:w-3.5 sm:h-3.5" />}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">Unlimited Undo Add-on</div>
                      <div className="text-[8px] sm:text-[10px] text-white/40 uppercase tracking-tight">+₹{PRICING_CONFIG.UNDO_ADDON_MONTHLY} / month</div>
                    </div>
                  </div>
                  <Zap size={14} className={includeUndo ? 'text-[#f5c518] sm:w-4.5 sm:h-4.5' : 'text-white/20 sm:w-4.5 sm:h-4.5'} />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUpgradePremium}
                className="w-full py-2.5 sm:py-4 bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-black tracking-[0.2em] rounded-2xl shadow-xl hover:brightness-110 transition-all uppercase text-[10px] sm:text-sm"
              >
                Get Premium Bundle
              </motion.button>
            </motion.div>
 
            {/* Standalone Undo Card */}
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-gradient-to-br from-[#1a1608] to-[#0d0a02] border-2 border-[#d9ad33]/40 rounded-3xl p-4 sm:p-6 md:p-8 text-center shadow-[0_0_50px_rgba(217,173,51,0.1)] flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 sm:p-4">
                <div className="bg-[#d9ad33] text-black text-[8px] sm:text-[10px] font-black px-2 py-0.5 sm:px-3 sm:py-1 rounded-full tracking-widest uppercase shadow-lg">STANDALONE</div>
              </div>
              <h3 className="text-[#d9ad33] font-serif tracking-[0.3em] uppercase mb-2 sm:mb-4 text-xs sm:text-sm">UNDO ONLY</h3>
              <div className="flex items-center justify-center gap-2 mb-4 sm:mb-8">
                <Zap size={24} className="text-[#d9ad33] sm:w-8 sm:h-8" />
                <span className="text-lg sm:text-2xl font-bold text-white uppercase tracking-widest">Unlimited Undos</span>
              </div>
              
              <div className="flex-1 space-y-4 mb-8">
                <button 
                  onClick={() => { playSound('click'); setSelectedUndoPlan('day'); }}
                  className={cn(
                    "w-full p-4 border rounded-2xl flex items-center justify-between transition-all",
                    selectedUndoPlan === 'day' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Clock size={20} className={selectedUndoPlan === 'day' ? "text-[#d9ad33]" : "text-white/40"} />
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">Daily Pass</div>
                      <div className="text-[10px] text-white/40 uppercase">24 Hours Access</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_DAILY}</span>
                </button>

                <button 
                  onClick={() => { playSound('click'); setSelectedUndoPlan('month'); }}
                  className={cn(
                    "w-full p-4 border rounded-2xl flex items-center justify-between transition-all",
                    selectedUndoPlan === 'month' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={20} className={selectedUndoPlan === 'month' ? "text-[#d9ad33]" : "text-white/40"} />
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">Monthly Pass</div>
                      <div className="text-[10px] text-white/40 uppercase">30 Days Access</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_MONTHLY}</span>
                </button>

                <button 
                  onClick={() => { playSound('click'); setSelectedUndoPlan('year'); }}
                  className={cn(
                    "w-full p-4 border rounded-2xl flex items-center justify-between transition-all",
                    selectedUndoPlan === 'year' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Crown size={20} className={selectedUndoPlan === 'year' ? "text-[#d9ad33]" : "text-white/40"} />
                    <div className="text-left">
                      <div className="text-sm font-bold text-white">Yearly Pass</div>
                      <div className="text-[10px] text-white/40 uppercase">Best Value</div>
                    </div>
                  </div>
                  <span className="text-lg font-black text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_YEARLY}</span>
                </button>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleBuyUndoStandalone(selectedUndoPlan)}
                className="w-full py-2.5 sm:py-4 bg-[#d9ad33] text-black font-black tracking-[0.2em] rounded-2xl shadow-xl hover:bg-[#f5d666] transition-all uppercase text-[10px] sm:text-sm"
              >
                Buy Undo Pass
              </motion.button>
            </motion.div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {/* Comparison Table (Simplified) */}
          <div className="mt-20 bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-bold text-white tracking-widest uppercase">Plan Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] text-white/40 tracking-widest uppercase border-b border-white/10">
                    <th className="p-6 font-bold">Feature</th>
                    <th className="p-6 font-bold text-center">Free</th>
                    <th className="p-6 font-bold text-center text-[#d9ad33]">Premium</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-white/5">
                    <td className="p-6 text-white/80">Play vs Computer/Friends</td>
                    <td className="p-6 text-center text-green-500">✓</td>
                    <td className="p-6 text-center text-green-500">✓</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-6 text-white/80">Move History</td>
                    <td className="p-6 text-center text-white/40">Limited</td>
                    <td className="p-6 text-center text-green-500">Full</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-6 text-white/80">AI Analysis</td>
                    <td className="p-6 text-center text-red-500/50">✕</td>
                    <td className="p-6 text-center text-green-500">✓</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-6 text-white/80">Video Export</td>
                    <td className="p-6 text-center text-red-500/50">✕</td>
                    <td className="p-6 text-center text-green-500">✓</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="p-6 text-white/80">Unlimited Undos</td>
                    <td className="p-6 text-center text-white/40">✕</td>
                    <td className="p-6 text-center text-[#d9ad33]">Add-on</td>
                  </tr>
                  <tr>
                    <td className="p-6 text-white/80">Daily Free Undos</td>
                    <td className="p-6 text-center text-white/40">2 per day</td>
                    <td className="p-6 text-center text-white/40">2 per day</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
