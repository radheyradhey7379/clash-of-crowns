import React from 'react';
import ScreenBackground from '../ui/ScreenBackground';
import { motion } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS } from '../../types';
import { ChevronLeft, Trash2, BarChart2, AlertTriangle, X, Download } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { AnimatePresence } from 'motion/react';
import { downloadElement } from '../../lib/utils';
import { useRef } from 'react';

interface StatsScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
  onReset: () => void;
}

export default function StatsScreen({ onNavigate, playerData, onReset }: StatsScreenProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';
  const total = playerData.wins + playerData.losses;
  const wr = total > 0 ? (playerData.wins / total) * 100 : 0;

  const stats = [
    { label: t.rating, value: playerData.rating, color: "#f5d666" },
    { label: "TIER", value: playerData.rating === 0 ? "UNRANKED" : ((t as any)[TIER_LABELS[Math.min(playerData.tier, 5)].toLowerCase()] || TIER_LABELS[Math.min(playerData.tier, 5)]), color: TIER_COLORS[playerData.tier] },
    { label: t.wins, value: playerData.wins, color: "#4ade80" },
    { label: t.losses, value: playerData.losses, color: "#f87171" },
    { label: t.winRate, value: `${wr.toFixed(1)}%`, color: "#fbbf24" },
    { label: t.streak, value: playerData.streak, color: "#f59e0b" },
    { label: t.bestStreak, value: playerData.bestStreak, color: "#d9ad33" },
    { label: t.totalGames, value: total, color: "#94a3b8" },
  ];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-20 flex items-center justify-between px-8 z-10">
        <motion.button
          whileHover={{ scale: 1.05, x: isRtl ? 5 : -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center gap-2 text-[#d9ad33] hover:text-[#f5d666] transition-colors font-bold tracking-widest text-sm"
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
          <span>{t.back}</span>
        </motion.button>
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-[#d9ad33]" />
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">{t.myStats}</h1>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (statsRef.current) {
                downloadElement(statsRef.current, `clash-of-crowns-stats-${playerData.name}.png`);
              }
            }}
            className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
            title="Download Stats"
          >
            <Download size={20} />
          </motion.button>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 p-6 md:p-10 overflow-y-auto z-10">
        <div ref={statsRef} className="max-w-5xl mx-auto p-4 rounded-3xl bg-black/20">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:bg-white/5 transition-all shadow-2xl"
              >
                <div className="absolute top-0 left-0 w-full h-1 opacity-50" style={{ backgroundColor: stat.color }} />
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold mb-2 font-serif group-hover:scale-110 transition-transform" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-[9px] tracking-[0.2em] text-[#8c7a52] font-bold uppercase">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Color Specific Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* White Stats */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
              <h3 className="text-xl font-bold text-white mb-6 tracking-[0.3em] font-serif uppercase">{t.whiteStats}</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-bold text-white mb-1">{playerData.whiteWins || 0}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.wins}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white/60 mb-1">{playerData.whiteLosses || 0}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.losses}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-2xl font-bold text-[#f5d666] mb-1">{formatTime(playerData.whiteTime || 0)}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.timePlayed}</div>
                </div>
              </div>
            </motion.div>

            {/* Black Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-1 h-full bg-[#d9ad33]/40" />
              <h3 className="text-xl font-bold text-[#d9ad33] mb-6 tracking-[0.3em] font-serif uppercase">{t.blackStats}</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-3xl font-bold text-[#d9ad33] mb-1">{playerData.blackWins || 0}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.wins}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#d9ad33]/60 mb-1">{playerData.blackLosses || 0}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.losses}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-2xl font-bold text-[#f5d666] mb-1">{formatTime(playerData.blackTime || 0)}</div>
                  <div className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">{t.timePlayed}</div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="mt-16 flex flex-col items-center gap-6">
            <div className="h-px bg-white/10 w-full max-w-md" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-3 px-10 py-4 bg-red-950/30 backdrop-blur-md text-red-400 border border-red-900/50 rounded-full font-bold tracking-widest hover:bg-red-900/40 transition-all text-xs"
            >
              <Trash2 size={16} />
              {t.reset}
            </motion.button>
            <p className="text-[#8c7a52] text-[10px] tracking-widest uppercase font-bold">Warning: This action is permanent</p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-red-900/30 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-600/50" />
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center text-red-500">
                  <AlertTriangle size={32} />
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 font-serif tracking-tight uppercase">{t.reset}?</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    This will permanently delete all your progress, ratings, and match history. This action cannot be undone.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onReset();
                      setShowConfirm(false);
                    }}
                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold tracking-widest uppercase text-xs hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20"
                  >
                    Confirm Reset
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConfirm(false)}
                    className="w-full py-4 bg-white/5 text-gray-400 rounded-xl font-bold tracking-widest uppercase text-xs hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>

              <button 
                onClick={() => setShowConfirm(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

