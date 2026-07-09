import React from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData, Language } from '../../types';
import { ChevronLeft, Music, Volume2, Info, Settings2, Undo2, Sparkles, Smartphone, Globe, ChevronRight, HelpCircle, Shield, BookOpen } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import ScreenBackground from '../ui/ScreenBackground';
import CommunityLinks from '../settings/CommunityLinks';
import { playSound } from '../../lib/sounds';

interface SettingsScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
  onUpdate: (newData: Partial<PlayerData>) => void;
}

export default function SettingsScreen({ onNavigate, playerData, onUpdate }: SettingsScreenProps) {
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';

  return (
    <div 
      className="screen-root w-full h-full relative flex flex-col bg-[#030204] overflow-hidden" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div 
        className="h-14 flex items-center justify-between z-10 w-full px-4 md:px-8 flex-shrink-0"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('click'); onNavigate('Home'); }}
          className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#d9ad33] hover:bg-white/10 transition-all"
          title={t.back}
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
        </motion.button>
        <h1 className="text-lg md:text-2xl font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">{t.settings}</h1>
        <div className="w-10 h-10" />
      </div>

      {/* Scrollable Wrapper */}
      <div 
        className="flex-1 w-full overflow-y-auto z-10"
        style={{
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-2xl w-full mx-auto flex flex-col items-center justify-start gap-4 pt-2 pb-8">

        {/* Settings Form */}
        <div className="w-full flex flex-col gap-4 bg-black/30 border border-white/5 p-4 md:p-6 rounded-2xl">
          
          {/* Sound & Graphics Group */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[10px] text-[#8c7a52] uppercase font-bold tracking-[0.25em] border-b border-white/5 pb-1">Sound & Graphics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SettingRow
                icon={<Music size={16} />}
                label={t.music}
                value={playerData.musicOn}
                onChange={(v) => onUpdate({ musicOn: v })}
              />
              <SettingRow
                icon={<Volume2 size={16} />}
                label={t.sfx}
                value={playerData.sfxOn}
                onChange={(v) => onUpdate({ sfxOn: v })}
              />
              <SettingRow
                icon={<Info size={16} />}
                label="Voice/Commentary"
                value={playerData.commentaryEnabled === true}
                onChange={(v) => onUpdate({ commentaryEnabled: v })}
              />
              <SettingRow
                icon={<Sparkles size={16} />}
                label="Vibration"
                value={playerData.vibrationOn !== false}
                onChange={(v) => onUpdate({ vibrationOn: v })}
              />
              <SettingRow
                icon={<Settings2 size={16} />}
                label="Low Graphics"
                value={playerData.lowGraphics || false}
                onChange={(v) => onUpdate({ lowGraphics: v, graphicsPreferenceSet: true })}
              />
            </div>
          </div>

          {/* Gameplay Group */}
          <div className="flex flex-col gap-3 mt-1">
            <h3 className="text-[10px] text-[#8c7a52] uppercase font-bold tracking-[0.25em] border-b border-white/5 pb-1">Gameplay</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SettingRow
                icon={<Undo2 size={16} />}
                label={t.undo}
                value={playerData.undoEnabled}
                onChange={(v) => onUpdate({ undoEnabled: v })}
              />
              <SettingRow
                icon={<Smartphone size={16} />}
                label="3D Camera Auto-Rotate"
                value={playerData.cameraAutoRotate !== false}
                onChange={(v) => onUpdate({ cameraAutoRotate: v })}
              />
            </div>

            {/* Preferred Side */}
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-white text-[10px] font-semibold tracking-wider uppercase">Preferred Side</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { playSound('click'); onUpdate({ preferredSide: 'w' }); }}
                  className={`py-2 px-3 rounded-xl font-bold tracking-wider text-[10px] transition-all border ${
                    playerData.preferredSide === 'w' 
                      ? "bg-[#d9ad33] text-black border-[#d9ad33]" 
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  }`}
                >
                  WHITE
                </button>
                <button
                  onClick={() => { playSound('click'); onUpdate({ preferredSide: 'b' }); }}
                  className={`py-2 px-3 rounded-xl font-bold tracking-wider text-[10px] transition-all border ${
                    playerData.preferredSide === 'b' 
                      ? "bg-[#d9ad33] text-black border-[#d9ad33]" 
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  }`}
                >
                  BLACK
                </button>
              </div>
            </div>

            {/* Language Selection */}
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-white text-[10px] font-semibold tracking-wider uppercase">{t.language}</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['en', 'hi', 'ur', 'ar'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => { playSound('click'); onUpdate({ language: lang }); }}
                    className={`py-2 px-2 rounded-lg font-bold tracking-wider text-[10px] transition-all border ${
                      playerData.language === lang 
                        ? "bg-[#d9ad33] text-black border-[#d9ad33]" 
                        : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {lang === 'en' ? 'ENGLISH' : lang === 'hi' ? 'हिन्दी' : lang === 'ur' ? 'اردو' : 'العربية'}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Sensitivity Slider */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-white text-[10px] font-semibold tracking-wider uppercase">{t.cameraSensitivity}</span>
                <span className="text-[#d9ad33] font-mono text-[10px]">{(playerData.cameraSensitivity || 1).toFixed(1)}x</span>
              </div>
              <input 
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={playerData.cameraSensitivity || 1}
                onChange={(e) => onUpdate({ cameraSensitivity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d9ad33]"
              />
            </div>

            {/* Font Size Slider */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-white text-[10px] font-semibold tracking-wider uppercase">{t.fontSize}</span>
                <span className="text-[#d9ad33] font-mono text-[10px]">{(playerData.fontSize || 1).toFixed(1)}x</span>
              </div>
              <input 
                type="range"
                min="0.8"
                max="1.4"
                step="0.1"
                value={playerData.fontSize || 1}
                onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d9ad33]"
              />
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="w-full flex flex-col gap-2">
          <NavButton
            icon={<HelpCircle size={16} />}
            label="Help & Support"
            onClick={() => { playSound('click'); onNavigate('HelpSupport'); }}
            isRtl={isRtl}
          />
          <NavButton
            icon={<Shield size={16} />}
            label="Your Data"
            onClick={() => { playSound('click'); onNavigate('YourData'); }}
            isRtl={isRtl}
          />
          <NavButton
            icon={<BookOpen size={16} />}
            label="About"
            onClick={() => { playSound('click'); onNavigate('About'); }}
            isRtl={isRtl}
          />
        </div>

        {/* Community Row */}
        <div className="w-full mt-2">
          <CommunityLinks />
        </div>

        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, value, onChange }: { icon: React.ReactNode, label: string, value: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-2.5">
        <div className="text-[#d9ad33] group-hover:scale-105 transition-transform">{icon}</div>
        <span className="text-white text-xs font-medium tracking-wide">{label}</span>
      </div>
      <button
        onClick={() => { playSound('click'); onChange(!value); }}
        className={`relative w-11 h-[22px] rounded-full transition-all duration-300 ${
          value ? "bg-[#d9ad33]" : "bg-white/10"
        }`}
      >
        <motion.div
          animate={{ x: value ? 22 : 2 }}
          className={`absolute top-[2px] w-[18px] h-[18px] rounded-full shadow-lg ${
            value ? "bg-black" : "bg-[#8c7a52]"
          }`}
        />
      </button>
    </div>
  );
}

function NavButton({ icon, label, onClick, isRtl }: { icon: React.ReactNode, label: string, onClick: () => void, isRtl: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full p-3.5 bg-black/30 border border-white/5 hover:bg-white/5 rounded-xl transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="text-[#d9ad33] group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-white text-sm font-medium tracking-wide">{label}</span>
      </div>
      <ChevronRight size={16} className={`text-white/30 group-hover:text-[#d9ad33] transition-colors ${isRtl ? "rotate-180" : ""}`} />
    </button>
  );
}
