import React from 'react';
import ScreenBackground from '../ui/ScreenBackground';
import { motion } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS, TIER_KEYS } from '../../types';
import { AI_CHARACTERS } from '../../game/ai/aiCharacters';
import { ChevronLeft, ChevronRight, Award, Download, Trash2, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { downloadElement } from '../../lib/utils';
import { useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';

export default function RankScreen({ onNavigate, playerData, onReset }: { onNavigate: (screen: AppScreen) => void, playerData: PlayerData, onReset: () => void }) {
  const t = useTranslation(playerData.language || 'en');
  const rankRef = useRef<HTMLDivElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';
  const tierIdx = Math.max(0, TIER_KEYS.indexOf(playerData.aiProgress?.tier || 'core'));
  const tierName = (t as any)[TIER_LABELS[tierIdx].toLowerCase()] || TIER_LABELS[tierIdx];
  const char = AI_CHARACTERS.find(c => c.tier === playerData.aiProgress?.tier && c.level === playerData.aiProgress?.level);
  const charName = char?.name || 'Unknown';
  const tierCol = TIER_COLORS[tierIdx];

  const totalLevels = AI_CHARACTERS.length;
  const myPos = char ? AI_CHARACTERS.indexOf(char) : 0;
  const progressPct = (myPos / totalLevels) * 100;
  const nextChar = AI_CHARACTERS[myPos + 1];
  const nextTierIdx = nextChar ? TIER_KEYS.indexOf(nextChar.tier) : tierIdx;

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-20 flex items-center justify-between px-8 z-10">
        <motion.button
          whileHover={{ scale: 1.05, x: isRtl ? 5 : -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center gap-2 text-[#8c7a52] hover:text-[#d9ad33] transition-all font-bold tracking-widest text-sm"
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
          <span>{t.back}</span>
        </motion.button>
        <div className="flex items-center gap-3">
          <Award size={24} className="text-[#d9ad33]" />
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">{t.rank}</h1>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowConfirm(true)}
            className="p-2 bg-black/40 border border-red-500/20 rounded-full text-red-500 hover:bg-red-500/10 transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)]"
            title="Reset Progress"
          >
            <Trash2 size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (rankRef.current) {
                downloadElement(rankRef.current, `clash-of-crowns-rank-${playerData.name}.png`);
              }
            }}
            className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
            title="Download Rank"
          >
            <Download size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05, x: isRtl ? -5 : 5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('Leaderboard')}
            className="flex items-center gap-2 text-[#d9ad33] hover:text-white transition-all font-bold tracking-widest text-xs"
          >
            <span>{t.leaderboard}</span>
            <ChevronRight size={18} className={isRtl ? "rotate-180" : ""} />
          </motion.button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-10 overflow-y-auto z-10 flex flex-col items-center">
        <div ref={rankRef} className="max-w-4xl w-full flex flex-col items-center my-auto p-4 rounded-3xl bg-black/20">
          {/* Rank Badge Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black/40 backdrop-blur-xl border p-10 rounded-2xl w-full max-w-xl text-center relative mb-12 shadow-2xl"
            style={{ borderColor: `${tierCol}66` }}
          >
            <div className="absolute top-0 left-0 w-full h-2 rounded-t-xl" style={{ backgroundColor: tierCol }} />
            <h2 className="text-5xl font-bold mb-6 font-serif tracking-tighter" style={{ color: tierCol }}>
              {playerData.rating === 0 ? "UNRANKED" : tierName}
            </h2>
            <div className="h-px bg-white/10 mb-6 mx-20" />
            <div className="text-white/40 text-[10px] tracking-[0.4em] mb-2 font-bold uppercase">{t.currentTitle}</div>
            <div className="text-3xl font-bold text-white mb-8 font-serif">{charName}</div>
            
            <div className="flex justify-around">
              <div className="flex flex-col items-center">
                <div className="text-white/40 text-[9px] tracking-widest mb-1 font-bold uppercase">{t.rating}</div>
                <div className="text-3xl font-bold text-[#d9ad33]">{playerData.rating}</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-white/40 text-[9px] tracking-widest mb-1 font-bold uppercase">{t.winRate}</div>
                <div className="text-3xl font-bold text-white">
                  {((playerData.wins / Math.max(playerData.wins + playerData.losses, 1)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </motion.div>

          {/* Journey Progress */}
          <div className="w-full max-w-2xl bg-black/20 backdrop-blur-md p-8 rounded-2xl border border-white/5 shadow-xl">
            <h3 className="text-white/40 text-xs font-bold tracking-[0.4em] text-center mb-8 uppercase">{t.journey}</h3>
            <div className="h-4 bg-black/40 rounded-full border border-white/10 relative overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-[#d9ad33] relative"
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </motion.div>
            </div>
            <div className="flex justify-between mt-4 text-[9px] text-white/20 font-bold tracking-widest px-1 uppercase">
              <span>Cadet</span>
              <span>Grandmaster</span>
            </div>
            <p className="text-center text-[#d9ad33] mt-6 text-[10px] font-bold tracking-widest uppercase">
              Level {myPos + 1} of {totalLevels}
            </p>
          </div>

          {/* Next Rank Teaser */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex items-center gap-4 bg-black/40 backdrop-blur-sm px-8 py-4 border border-white/10 rounded-full shadow-lg"
          >
            <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase">{t.nextRank}:</span>
            <span className="text-[#d9ad33] font-serif text-lg font-bold">
              {nextChar ? `${(t as any)[TIER_LABELS[nextTierIdx].toLowerCase()] || TIER_LABELS[nextTierIdx]} - ${nextChar.name}` : t.maxRank}
            </span>
          </motion.div>
        </div>
      </div>
      
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1a161e] border border-white/10 p-8 rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden"
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

