import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Users, Globe, X, AlertTriangle, Trophy } from 'lucide-react';
import { isFeatureAvailable, getFeatureUnavailableReason } from '../../lib/config/featureAvailability';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'computer' | 'friend' | 'multiplayer' | 'tournament') => void;
}

export default function StartGameModal({ isOpen, onClose, onSelectMode }: StartGameModalProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleMultiplayerClick = () => {
    if (!isFeatureAvailable('multiplayer')) {
      const reason = getFeatureUnavailableReason('multiplayer') || "Multiplayer is currently unavailable.";
      setToastMsg(reason);
      setTimeout(() => setToastMsg(null), 4000);
      return;
    }
    onSelectMode('multiplayer');
  };

  const handleLockedClick = (reason: string) => {
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
              
              <ModeButton
                icon={<Globe size={18} />}
                label="CASUAL / FRIEND MATCH"
                description={
                  isFeatureAvailable('multiplayer') 
                    ? "Casual/Friend Match: online room/link play, no ranked points" 
                    : `Inactive — ${getFeatureUnavailableReason('multiplayer') || "Gates failed"}`
                }
                onClick={handleMultiplayerClick}
                color={!isFeatureAvailable('multiplayer') ? "opacity-60 hover:bg-white/5 border-white/10" : "hover:bg-white/5 border-[#d9ad33]/30"}
              />

              <ModeButton
                icon={<Globe size={18} className="opacity-40" />}
                label="RANKED MATCH"
                description="Coming Soon / Beta Locked"
                onClick={() => handleLockedClick("Ranked Match: competitive rank points (Bronze, Silver, Gold, Platinum, Diamond, Master, Crown, Conqueror tiers), win/loss ELO adjustments. Coming soon/beta locked.")}
                color="opacity-50 border-white/5 cursor-pointer"
              />

              <ModeButton
                icon={<Trophy size={18} className="opacity-40" />}
                label="CHAMPIONSHIP TOURNAMENT"
                description="Coming Soon / Locked"
                onClick={() => handleLockedClick("Tournament: multi-player bracket event, server-controlled advancement and rewards. Locked.")}
                color="opacity-50 border-white/5 cursor-pointer"
              />
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
