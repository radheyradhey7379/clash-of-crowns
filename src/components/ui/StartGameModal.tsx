import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Users, Globe, X, AlertTriangle, Trophy } from 'lucide-react';
import { isFeatureAvailable, getEffectiveNodeHealth, getEffectiveRustHealth } from '../../lib/config/featureAvailability';
import { isOnlineBetaEnabled } from '../../lib/config/featureFlags';
import { isFirebaseConfigured, auth } from '../../lib/firebase';
import { PlayerData } from '../../types';
import { 
  getCareerLevel, 
  canAccessCasualOnline, 
  canAccessRanked, 
  canAccessTournament 
} from '../../lib/unlocks/multiplayerUnlocks';
import { playSound } from '../../lib/sounds';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'computer' | 'friend' | 'multiplayer' | 'tournament') => void;
  playerData: PlayerData;
}

export default function StartGameModal({ isOpen, onClose, onSelectMode, playerData }: StartGameModalProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [premiumComingSoonOpen, setPremiumComingSoonOpen] = useState(false);

  const playerLevel = getCareerLevel(playerData.aiProgress);
  const entitlements = playerData.entitlements || { multiplayerPass: false, championshipPass: false };
  const casualUnlocked = canAccessCasualOnline(playerData.aiProgress, entitlements);
  const rankedUnlocked = canAccessRanked(playerData.aiProgress, entitlements);
  const tournamentUnlocked = canAccessTournament(playerData.aiProgress, entitlements);

  const handleLockedClick = (reason: string) => {
    playSound('click');
    setToastMsg(reason);
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="play-popup relative bg-[#030204] border border-white/10 shadow-2xl w-full max-w-md p-6 rounded-2xl"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="play-popup-title font-bold text-[#d9ad33] font-serif text-center mb-6 tracking-[0.3em] uppercase text-lg">
              CHOOSE BATTLE MODE
            </h2>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <ModeButton
                icon={<Monitor size={18} />}
                label="VERSUS COMPUTER"
                description="Challenge the AI tiers locally"
                onClick={() => onSelectMode('computer')}
                color="hover:bg-white/5 border-white/10"
              />
              <ModeButton
                icon={<Users size={18} />}
                label="VERSUS FRIEND (LOCAL)"
                description="Local play on one device"
                onClick={() => onSelectMode('friend')}
                color="hover:bg-white/5 border-white/10"
              />
              
              <div className="h-px bg-white/10 my-2" />
              <div className="text-[9px] text-[#8c7a52] font-black uppercase tracking-[0.2em] pl-2 mb-1">
                Online Multiplayer
              </div>
              
              {/* Casual / Friend Match */}
              {(() => {
                if (!isFeatureAvailable('multiplayer')) {
                  return (
                    <ModeButton
                      icon={<Globe size={18} className="opacity-40" />}
                      label="CASUAL / FRIEND MATCH"
                      description="Online beta not enabled yet"
                      onClick={() => handleLockedClick("Online beta not enabled yet")}
                      color="opacity-50 border-white/5 cursor-pointer"
                    />
                  );
                }

                const nodeH = getEffectiveNodeHealth();
                const rustH = getEffectiveRustHealth();
                if (nodeH === 'failed' || rustH === 'failed') {
                  return (
                    <ModeButton
                      icon={<Globe size={18} className="opacity-40" />}
                      label="CASUAL / FRIEND MATCH"
                      description="Backend unavailable. Retry."
                      onClick={() => handleLockedClick("Backend unavailable. Retry.")}
                      color="opacity-60 border-red-500/20 hover:bg-red-950/10 cursor-pointer text-red-400"
                    />
                  );
                }
                if (nodeH === 'unknown' || rustH === 'unknown') {
                  return (
                    <ModeButton
                      icon={<Globe size={18} className="animate-spin opacity-60 text-yellow-500" />}
                      label="CASUAL / FRIEND MATCH"
                      description="Checking connection..."
                      onClick={() => {}}
                      color="opacity-60 border-white/10 cursor-not-allowed"
                    />
                  );
                }

                const isAuthRequired = isFirebaseConfigured;
                const isUserLoggedIn = auth?.currentUser != null;
                const isBeta = isOnlineBetaEnabled();
                if (isAuthRequired && !isUserLoggedIn && !isBeta) {
                  return (
                    <ModeButton
                      icon={<Globe size={18} className="opacity-40" />}
                      label="CASUAL / FRIEND MATCH"
                      description="Login required for permanent online progress."
                      onClick={() => handleLockedClick("Login required for permanent online progress.")}
                      color="opacity-60 border-white/10 cursor-pointer"
                    />
                  );
                }

                if (!casualUnlocked) {
                  return (
                    <div className="border border-white/10 p-3 rounded-xl bg-white/5 flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <div className="text-[#d9ad33]">
                          <Globe size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white tracking-widest text-xs md:text-sm">CASUAL / FRIEND MATCH</div>
                          <div className="text-[#f44336] uppercase tracking-[0.12em] text-[8px] md:text-[9px] mt-0.5">
                            Unlock at Level 5 Comp Career (Current: Level {playerLevel})
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => {
                            playSound('click');
                            onClose();
                            onSelectMode('computer');
                          }}
                          className="flex-1 bg-[#d9ad33] hover:bg-[#b88f28] text-black font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Play Comp Career
                        </button>
                        <button
                          onClick={() => {
                            playSound('click');
                            setPremiumComingSoonOpen(true);
                          }}
                          className="flex-1 border border-[#d9ad33] text-[#d9ad33] hover:bg-[#d9ad33]/10 font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Unlock with Premium
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <ModeButton
                    icon={<Globe size={18} />}
                    label="CASUAL / FRIEND MATCH"
                    description="Casual/Friend Match: online room/link play, no ranked points"
                    onClick={() => onSelectMode('multiplayer')}
                    color="hover:bg-white/5 border-[#d9ad33]/30"
                  />
                );
              })()}

              {/* Ranked Match */}
              {(() => {
                const infoText = "Competitive rank points: Bronze → Silver → Gold → Platinum → Diamond → Master → Crown → Conqueror";
                
                if (!rankedUnlocked) {
                  return (
                    <div className="border border-white/10 p-3 rounded-xl bg-white/5 flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <div className="text-white/40">
                          <Globe size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white/60 tracking-widest text-xs md:text-sm">RANKED MATCH</div>
                          <div className="text-white/40 uppercase tracking-[0.12em] text-[8px] mt-0.5 leading-relaxed font-sans font-medium">
                            {infoText}
                          </div>
                          <div className="text-[#f44336] uppercase tracking-[0.12em] text-[8px] md:text-[9px] mt-1 font-bold">
                            Unlock at Level 15 / Coming Soon Beta (Current: Level {playerLevel})
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => {
                            playSound('click');
                            onClose();
                            onSelectMode('computer');
                          }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Improve in Comp Career
                        </button>
                        <button
                          onClick={() => {
                            playSound('click');
                            setPremiumComingSoonOpen(true);
                          }}
                          className="flex-1 border border-white/20 text-white/60 hover:bg-white/5 font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Premium users get early access when beta opens
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <ModeButton
                    icon={<Globe size={18} className="opacity-60" />}
                    label="RANKED MATCH"
                    description="Coming Soon / Beta Locked"
                    onClick={() => handleLockedClick("Ranked Match unlocks after Level 15 or Premium + verification. Currently coming soon.")}
                    color="opacity-50 border-white/5 cursor-pointer"
                  />
                );
              })()}

              {/* Championship Tournament */}
              {(() => {
                const infoText = "Bracket event with server-controlled rounds and rewards";
                
                if (!tournamentUnlocked) {
                  return (
                    <div className="border border-white/10 p-3 rounded-xl bg-white/5 flex flex-col gap-2">
                      <div className="flex items-center gap-4">
                        <div className="text-white/40">
                          <Trophy size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-bold text-white/60 tracking-widest text-xs md:text-sm">CHAMPIONSHIP TOURNAMENT</div>
                          <div className="text-white/40 uppercase tracking-[0.12em] text-[8px] mt-0.5 leading-relaxed font-sans font-medium">
                            {infoText}
                          </div>
                          <div className="text-[#f44336] uppercase tracking-[0.12em] text-[8px] md:text-[9px] mt-1 font-bold">
                            Unlock at Level 20 / Coming Soon (Current: Level {playerLevel})
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => {
                            playSound('click');
                            onClose();
                            onSelectMode('computer');
                          }}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Play Comp Career
                        </button>
                        <button
                          onClick={() => {
                            playSound('click');
                            setPremiumComingSoonOpen(true);
                          }}
                          className="flex-1 border border-white/20 text-white/60 hover:bg-white/5 font-bold uppercase tracking-[0.1em] text-[9px] py-1.5 px-2 rounded-lg transition-colors text-center"
                        >
                          Championship Pass coming soon
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <ModeButton
                    icon={<Trophy size={18} className="opacity-60" />}
                    label="CHAMPIONSHIP TOURNAMENT"
                    description="Coming Soon / Locked"
                    onClick={() => handleLockedClick("Tournament unlocks after Level 20 or Championship Pass. Currently coming soon.")}
                    color="opacity-50 border-white/5 cursor-pointer"
                  />
                );
              })()}
            </div>

            <div className="text-[10px] text-white/40 text-center mt-4 font-sans leading-normal">
              Online modes unlock through Comp progress or Premium Pass. Ranked and Tournament require server verification.
            </div>

            <AnimatePresence>
              {toastMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 p-3 bg-red-950/40 border border-red-500/20 rounded-xl flex items-center gap-2"
                >
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <span className="text-red-200 text-xs text-left leading-normal font-sans">{toastMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Premium Coming Soon Overlay Modal */}
      {premiumComingSoonOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setPremiumComingSoonOpen(false)} />
          <div className="relative bg-[#0d0a15] border border-[#d9ad33]/30 shadow-2xl w-full max-w-sm p-6 rounded-2xl text-center">
            <Trophy size={48} className="text-[#d9ad33] mx-auto mb-4" />
            <h3 className="text-white font-serif font-bold text-lg uppercase tracking-wider mb-2">
              Premium Pass
            </h3>
            <p className="text-white/60 text-xs font-sans leading-relaxed mb-6">
              Premium Pass is coming soon. For now, unlock Online Multiplayer by reaching Level 5 in Comp Career.
            </p>
            <button
              onClick={() => setPremiumComingSoonOpen(false)}
              className="bg-[#d9ad33] hover:bg-[#b88f28] text-black font-bold uppercase tracking-[0.1em] text-xs py-2 px-6 rounded-lg transition-colors w-full"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ModeButton({ icon, label, description, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className={`play-mode-button flex items-center gap-4 border transition-all group p-3 rounded-xl cursor-pointer ${color}`}
    >
      <div className="text-[#d9ad33] group-hover:scale-105 transition-transform shrink-0">
        {icon}
      </div>
      <div className="text-left">
        <div className="font-bold text-white tracking-widest text-xs md:text-sm">{label}</div>
        <div className="play-mode-subtitle text-[#8c7a52] group-hover:text-[#d9ad33] transition-colors uppercase tracking-[0.15em] text-[8px] md:text-[9px] mt-0.5">{description}</div>
      </div>
    </button>
  );
}
