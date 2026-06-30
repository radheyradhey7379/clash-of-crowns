import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Trophy, Shield, Lock, Crown, Users } from 'lucide-react';
import { PlayerData } from '../../types';
import { playSound } from '../../lib/sounds';
import { isMultiplayerEnabled } from '../../lib/config/featureFlags';
import { useTranslation } from '../../lib/translations';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'computer' | 'friend' | 'multiplayer' | 'tournament') => void;
  playerData: PlayerData;
}

export default function StartGameModal({ isOpen, onClose, onSelectMode, playerData }: StartGameModalProps) {
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            className="relative bg-[#030204] border-2 border-[#d9ad33]/30 shadow-2xl w-full h-full md:h-auto md:max-w-4xl p-6 md:p-10 rounded-none md:rounded-3xl flex flex-col justify-between md:justify-start overflow-y-auto md:overflow-y-visible z-10"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {/* Top Crown Accent */}
            <div className="flex justify-center mb-1 shrink-0">
              <Crown size={28} className="text-[#d9ad33] drop-shadow-[0_0_8px_rgba(217,173,51,0.5)] animate-pulse" />
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer p-2 z-20"
              title="Close"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="text-center mb-8 shrink-0">
              <h2 className="font-bold text-[#d9ad33] font-serif text-center tracking-[0.3em] uppercase text-xl md:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {t.chooseMode || "CHOOSE MODE"}
              </h2>
              <p className="text-white/40 text-[10px] md:text-xs font-sans tracking-wider mt-1.5">
                {t.chooseModeDesc || "Choose how you want to play Clash of Crowns"}
              </p>
            </div>

            {/* Content Groups */}
            <div className="flex flex-col gap-8 flex-1">
              
              {/* PLAY NOW SECTION */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-[#d9ad33]/40 to-[#d9ad33]/40 flex-1" />
                  <span className="text-[10px] md:text-xs text-[#d9ad33] font-bold tracking-[0.2em] uppercase">{t.playNow || "Play Now"}</span>
                  <div className="h-px bg-gradient-to-l from-transparent via-[#d9ad33]/40 to-[#d9ad33]/40 flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Card 1: Versus Computer */}
                  <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-[#131118]/80 to-[#0c0a0e]/95 border border-[#d9ad33]/30 shadow-xl relative group overflow-hidden min-h-[170px]">
                    <div className="flex gap-4 items-start">
                      <div className="w-14 h-14 bg-[#d9ad33]/10 border border-[#d9ad33]/20 rounded-xl flex items-center justify-center text-[#d9ad33] shrink-0 shadow-[0_0_15px_rgba(217,173,51,0.15)]">
                        <Crown size={28} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-white tracking-wider text-sm sm:text-base">{t.vsComputer || "VERSUS COMPUTER"}</h3>
                        <h4 className="text-[9px] text-[#d9ad33] font-bold tracking-widest uppercase mt-0.5">{t.compCareer || "Comp Career"}</h4>
                        <p className="text-white/60 text-[11px] mt-2 leading-relaxed font-sans">
                          {t.vsComputerDesc || "Challenge AI tiers and unlock stronger bots as you progress."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          playSound('click');
                          onSelectMode('computer');
                        }}
                        className="w-full py-2.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black rounded-xl font-bold tracking-widest uppercase text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#d9ad33]/20"
                      >
                        <span>{t.playCompCareer || "Play Comp Career"}</span>
                        <span className="text-[12px] font-sans">&gt;</span>
                      </motion.button>
                    </div>
                  </div>

                  {/* Card 2: Versus Friend Local */}
                  <div className="flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-b from-[#131118]/80 to-[#0c0a0e]/95 border border-[#d9ad33]/30 shadow-xl relative group overflow-hidden min-h-[170px]">
                    <div className="flex gap-4 items-start">
                      <div className="w-14 h-14 bg-[#d9ad33]/10 border border-[#d9ad33]/20 rounded-xl flex items-center justify-center text-[#d9ad33] shrink-0 shadow-[0_0_15px_rgba(217,173,51,0.15)]">
                        <Users size={28} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-white tracking-wider text-sm sm:text-base">{t.vsFriendLocal || "VERSUS FRIEND LOCAL"}</h3>
                        <h4 className="text-[9px] text-[#d9ad33] font-bold tracking-widest uppercase mt-0.5">{t.oneDevice || "One Device"}</h4>
                        <p className="text-white/60 text-[11px] mt-2 leading-relaxed font-sans">
                          {t.vsFriendLocalDesc || "Play locally with a friend on the same device."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          playSound('click');
                          onSelectMode('friend');
                        }}
                        className="w-full py-2.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black rounded-xl font-bold tracking-widest uppercase text-[10px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#d9ad33]/20"
                      >
                        <span>{t.startLocalMatch || "Start Local Match"}</span>
                        <span className="text-[12px] font-sans">&gt;</span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* COMING SOON SECTION (Only if multiplayer is enabled in config/env) */}
              {isMultiplayerEnabled() && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-white/10 flex-1" />
                    <span className="text-[10px] md:text-xs text-white/30 font-bold tracking-[0.2em] uppercase">Coming Soon</span>
                    <div className="h-px bg-gradient-to-l from-transparent via-white/10 to-white/10 flex-1" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    {/* Card 3: Online Friend Match */}
                    <div className="flex flex-col justify-between p-5 rounded-2xl bg-black/40 border border-white/5 opacity-50 relative overflow-hidden min-h-[160px] group">
                      <div className="absolute top-4 right-4 text-white/30">
                        <Lock size={12} />
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                          <Globe size={20} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-white/60 tracking-wider text-xs md:text-sm">ONLINE FRIEND MATCH</h3>
                          <h4 className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mt-0.5">Private Rooms</h4>
                          <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed font-sans">
                            Invite friends and play online.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          disabled
                          className="w-full py-2 bg-white/5 border border-white/10 text-white/30 rounded-xl font-bold tracking-widest uppercase text-[8px] font-sans"
                        >
                          Coming Soon Beta
                        </button>
                      </div>
                    </div>

                    {/* Card 4: Ranked Arena */}
                    <div className="flex flex-col justify-between p-5 rounded-2xl bg-black/40 border border-white/5 opacity-50 relative overflow-hidden min-h-[160px] group">
                      <div className="absolute top-4 right-4 text-white/30">
                        <Lock size={12} />
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                          <Trophy size={20} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-white/60 tracking-wider text-xs md:text-sm">RANKED ARENA</h3>
                          <h4 className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mt-0.5">Competitive Ladder</h4>
                          <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed font-sans">
                            Rank points: Bronze to Crown.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          disabled
                          className="w-full py-2 bg-white/5 border border-white/10 text-white/30 rounded-xl font-bold tracking-widest uppercase text-[8px] font-sans"
                        >
                          Unlocks at Level 15
                        </button>
                      </div>
                    </div>

                    {/* Card 5: Championship Tournament */}
                    <div className="flex flex-col justify-between p-5 rounded-2xl bg-black/40 border border-white/5 opacity-50 relative overflow-hidden min-h-[160px] group">
                      <div className="absolute top-4 right-4 text-white/30">
                        <Lock size={12} />
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-white/40 shrink-0">
                          <Shield size={20} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-white/60 tracking-wider text-xs md:text-sm">CHAMPIONSHIP TOURNAMENT</h3>
                          <h4 className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mt-0.5">Server Events</h4>
                          <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed font-sans">
                            Bracket and reward-based tournaments.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          disabled
                          className="w-full py-2 bg-white/5 border border-white/10 text-white/30 rounded-xl font-bold tracking-widest uppercase text-[8px] font-sans"
                        >
                          Unlocks at Level 20
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="mt-8 border-t border-white/5 pt-4 text-center shrink-0">
              <p className="text-[10px] text-white/40 font-sans tracking-wide leading-normal flex items-center justify-center gap-1.5">
                <Crown size={12} className="text-[#d9ad33]/60" />
                <span>Online modes are coming soon. Build your Comp Career progress now.</span>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
