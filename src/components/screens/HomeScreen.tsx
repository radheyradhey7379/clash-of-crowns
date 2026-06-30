import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { Settings, Award, Trophy, Play, Book, BarChart2, MessageSquare, Gamepad2, Crown, Palette } from 'lucide-react';
import StartGameModal from '../ui/StartGameModal';
import LocalGameSetupModal from '../ui/LocalGameSetupModal';
import MultiplayerSetupModal from '../ui/MultiplayerSetupModal';
import { auth } from '../../lib/firebase';
import { useTranslation } from '../../lib/translations';
import { cn } from '../../lib/utils';
import { playSound } from '../../lib/sounds';
import ScreenBackground from '../ui/ScreenBackground';
import OfflinePackageModal from '../ui/OfflinePackageModal';
import { getOfflinePackageMetadata } from '../../lib/offline/offlinePackage';
import { isMultiplayerEnabled } from '../../lib/config/featureFlags';
import { useEffect } from 'react';

interface HomeScreenProps {
  onNavigate: (screen: AppScreen, level?: any, localConfig?: any, multiplayerConfig?: any) => void;
  playerData: PlayerData;
}

export default function HomeScreen({ onNavigate, playerData }: HomeScreenProps) {
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isLocalSetupOpen, setIsLocalSetupOpen] = useState(false);
  const [isMultiplayerSetupOpen, setIsMultiplayerSetupOpen] = useState(false);
  const [isGPGModalOpen, setIsGPGModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';

  useEffect(() => {
    const metadata = getOfflinePackageMetadata();
    const skipped = localStorage.getItem('clash_offline_package_prompt_skipped') === 'true';
    const sessionReminded = sessionStorage.getItem('clash_offline_package_prompt_session_reminded') === 'true';

    if (metadata.status === 'not_downloaded' && !skipped && !sessionReminded) {
      const timer = setTimeout(() => {
        setIsOfflineModalOpen(true);
        sessionStorage.setItem('clash_offline_package_prompt_session_reminded', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSelectMode = (mode: 'computer' | 'friend' | 'multiplayer' | 'tournament') => {
    playSound('click');
    setIsStartModalOpen(false);
    if (mode === 'computer') {
      onNavigate('LevelSelect');
    } else if (mode === 'friend') {
      setIsLocalSetupOpen(true);
    } else if (mode === 'multiplayer') {
      setIsMultiplayerSetupOpen(true);
    } else if (mode === 'tournament') {
      onNavigate('Tournament');
    }
  };

  const handleStartLocalGame = (config: any) => {
    setIsLocalSetupOpen(false);
    (onNavigate as any)('Game', null, config);
  };

  const handleStartMultiplayerGame = (config: any) => {
    setIsMultiplayerSetupOpen(false);
    onNavigate('Game', null, null, config);
  };

  const handleSupport = () => {
    playSound('click');
    window.location.href = "mailto:support@clashofcrowns.com";
  };

  return (
    <div 
      className="home-screen screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <ScreenBackground playerData={playerData} opacity={0.6} />

      <div 
        className="absolute top-0 left-0 w-full h-24 flex items-center justify-between z-20"
        style={{
          paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
          paddingRight: 'calc(2rem + env(safe-area-inset-right))',
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))'
        }}
      >
        {/* Top Left Profile Button */}
        <motion.button
          whileHover={{ scale: 1.02, x: isRtl ? -5 : 5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playSound('click');
            onNavigate('Profile');
          }}
          className="profile-card flex items-center gap-2 bg-black/30 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all group"
        >
          <div className="profile-avatar rounded-full bg-[#d9ad33] border border-[#f5d666] flex items-center justify-center shadow-[0_0_15px_rgba(217,173,51,0.3)] overflow-hidden">
            <img 
              src={auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerData.name}`} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5">
              <span className="profile-name text-white font-bold tracking-wider group-hover:text-[#f5d666] transition-colors">
                {playerData.name || t.champion}
              </span>
              <span className={cn(
                "text-[7px] px-1 rounded font-black tracking-tighter",
                playerData.isPremium 
                ? "bg-[#a855f7] text-white" 
                : "bg-white/10 text-white/40 border border-white/10"
              )}>
                {playerData.isPremium ? "PREMIUM" : "FREE"}
              </span>
            </div>
            <span className="profile-elo text-[#d9ad33] font-bold tracking-[0.2em]">
              Elo: {playerData.rating}
            </span>
          </div>
        </motion.button>
        
        {/* Top Middle Welcome Text - REMOVED */}

        {/* Top Right Buttons */}
        <div className="flex gap-2 sm:gap-4 md:gap-6 items-center">
          <NavIconButton icon={<Crown size={18} />} label="Premium" onClick={() => {
            playSound('click');
            onNavigate('Premium');
          }} />
          {isMultiplayerEnabled() && (
            <NavIconButton icon={<MessageSquare size={18} />} label={t.chat} onClick={() => {
              playSound('click');
              onNavigate('Chat');
            }} />
          )}
          <NavIconButton icon={<Settings size={18} />} label={t.settings} onClick={() => {
            playSound('click');
            onNavigate('Settings');
          }} />
          <NavIconButton icon={<BarChart2 size={18} />} label={t.stats} onClick={() => {
            playSound('click');
            onNavigate('Stats');
          }} />
          <NavIconButton icon={<Award size={18} />} label={t.rank} onClick={() => {
            playSound('click');
            onNavigate('Rank');
          }} />
          {isMultiplayerEnabled() && (
            <NavIconButton icon={<Trophy size={18} />} label={t.leaderboard} onClick={() => {
              playSound('click');
              onNavigate('Leaderboard');
            }} />
          )}
        </div>
      </div>

      {/* Lower Middle Action Buttons */}
      <div 
        className="flex-1 flex flex-col items-center justify-end pb-4 sm:pb-8 lg:pb-16 z-10 overflow-y-auto"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              playSound('click');
              setIsStartModalOpen(true);
            }}
            className="play-button relative bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center gap-3 group overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Play className={`text-[#f5d666] fill-[#f5d666] top-nav-icon ${isRtl ? "rotate-180" : ""}`} />
            <span className="text-white font-bold tracking-[0.3em]">{t.play}</span>
          </motion.button>

          <div className="flex gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playSound('click');
                onNavigate('Learn');
              }}
              className="text-[#8c7a52] hover:text-[#d9ad33] text-body font-bold tracking-[0.2em] transition-colors flex items-center gap-2 uppercase"
            >
              <Book size={14} />
              {t.academy}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playSound('click');
                onNavigate('Customise');
              }}
              className="text-[#8c7a52] hover:text-[#d9ad33] text-body font-bold tracking-[0.2em] transition-colors flex items-center gap-2 uppercase"
            >
              <Palette size={14} />
              {t.customise || 'Customise'}
            </motion.button>
          </div>
        </motion.div>
      </div>

      <StartGameModal 
        isOpen={isStartModalOpen} 
        onClose={() => {
          playSound('click');
          setIsStartModalOpen(false);
        }} 
        onSelectMode={handleSelectMode}
        playerData={playerData}
      />
      <LocalGameSetupModal
        isOpen={isLocalSetupOpen}
        onClose={() => setIsLocalSetupOpen(false)}
        onStart={handleStartLocalGame}
      />
      <MultiplayerSetupModal
        isOpen={isMultiplayerSetupOpen}
        onClose={() => setIsMultiplayerSetupOpen(false)}
        playerData={playerData}
        onStart={handleStartMultiplayerGame}
      />
      <OfflinePackageModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
      />
    </div>
  );
}

function CrownsButton({ label, color, textColor, icon, onClick, large }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, x: 5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative ${large ? 'h-16 w-80' : 'h-14 w-64'} ${color} flex items-center px-6 overflow-hidden group border-l-4 border-[#d9ad33]`}
    >
      <div className="mr-4 text-[#d9ad33]">{icon}</div>
      <span className={`font-bold tracking-[0.2em] ${textColor} ${large ? 'text-lg' : 'text-sm'}`}>{label}</span>
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
    </motion.button>
  );
}

function NavIconButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="top-nav-item flex flex-col items-center gap-1 group">
      <div className="top-nav-icon text-[#99834d] group-hover:text-[#d9ad33] transition-colors">{icon}</div>
      <span className="text-small text-[#6b5b36] group-hover:text-[#99834d] tracking-widest font-bold hidden lg:block">{label}</span>
    </button>
  );
}

