import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Users, Globe, X, AlertTriangle, Trophy } from 'lucide-react';
import { isMultiplayerEnabled, getDisabledFeatureMessage } from '../../lib/config/featureFlags';
import { isFeatureAvailable } from '../../lib/config/featureAvailability';

interface StartGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: 'computer' | 'friend' | 'multiplayer' | 'tournament') => void;
}

export default function StartGameModal({ isOpen, onClose, onSelectMode }: StartGameModalProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleMultiplayerClick = () => {
    if (!isMultiplayerEnabled()) {
      setToastMsg(getDisabledFeatureMessage('multiplayer'));
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    onSelectMode('multiplayer');
  };

  const handleTournamentClick = () => {
    if (!isFeatureAvailable('tournaments')) {
      setToastMsg("Tournaments are currently locked or server health check failed.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }
    onSelectMode('tournament');
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
            className="play-popup relative bg-[#030204] border border-white/10 shadow-2xl"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="play-popup-title font-bold text-[#d9ad33] font-serif text-center mb-6 tracking-[0.3em] uppercase">
              CHOOSE BATTLE MODE
            </h2>

            <div className="flex flex-col gap-4">
              <ModeButton
                icon={<Monitor size={20} />}
                label="VERSUS COMPUTER"
                description="Challenge the AI tiers"
                onClick={() => onSelectMode('computer')}
                color="hover:bg-white/5 border-white/10"
              />
              <ModeButton
                icon={<Users size={20} />}
                label="VERSUS FRIEND"
                description="Local play on one device"
                onClick={() => onSelectMode('friend')}
                color="hover:bg-white/5 border-white/10"
              />
              {/* MULTIPLAYER_PAUSED_FOR_V1 */}
              <ModeButton
                icon={<Globe size={20} />}
                label="MULTIPLAYER"
                description={isMultiplayerEnabled() ? "Online Friend Match" : "Coming Soon"}
                onClick={handleMultiplayerClick}
                color={!isMultiplayerEnabled() ? "opacity-50 hover:bg-white/5 border-white/10" : "hover:bg-white/5 border-white/10"}
              />
              <ModeButton
                icon={<Trophy size={20} />}
                label="CHAMPIONSHIP TOURNAMENT"
                description={isFeatureAvailable('tournaments') ? "Join official bracket" : "Locked / Coming Soon"}
                onClick={handleTournamentClick}
                color={!isFeatureAvailable('tournaments') ? "opacity-50 hover:bg-white/5 border-white/10" : "hover:bg-white/5 border-white/10"}
              />
            </div>

            <AnimatePresence>
              {toastMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded flex items-center gap-2"
                >
                  <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  <span className="text-red-200 text-xs text-left leading-tight">{toastMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ModeButton({ icon, label, description, onClick, disabled, color }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`play-mode-button flex items-center gap-4 border transition-all group ${color}`}
    >
      <div className="text-[#d9ad33] group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-left">
        <div className="font-bold text-white tracking-widest text-sm md:text-base">{label}</div>
        <div className="play-mode-subtitle text-[#8c7a52] group-hover:text-[#d9ad33] transition-colors uppercase tracking-[0.2em]">{description}</div>
      </div>
    </button>
  );
}
