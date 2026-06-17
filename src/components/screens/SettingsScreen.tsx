import React from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData, Language } from '../../types';
import { ChevronLeft, Music, Volume2, Info, Settings2, Type, Layout, Undo2, Globe } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import ScreenBackground from '../ui/ScreenBackground';

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
      className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <ScreenBackground playerData={playerData} opacity={0.4} />

      {/* Top Bar */}
      <div 
        className="h-20 flex items-center justify-between px-8 z-10"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingTop: 'env(safe-area-inset-top)'
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05, x: isRtl ? 5 : -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-[#d9ad33]/20 text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all"
          title={t.back}
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
        </motion.button>
        <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">{t.settings}</h1>
        <div className="w-32" />
      </div>

      <div 
        className="flex-1 flex items-center justify-center p-6 md:p-10 z-10 overflow-y-auto"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-xl border border-white/10 p-6 md:p-12 rounded-2xl max-w-2xl w-full relative shadow-2xl my-auto"
        >
          <div className="flex flex-col gap-8">
            <SettingRow
              icon={<Music size={20} />}
              label={t.music}
              value={playerData.musicOn}
              onChange={(v) => onUpdate({ musicOn: v })}
            />
            <SettingRow
              icon={<Volume2 size={20} />}
              label={t.sfx}
              value={playerData.sfxOn}
              onChange={(v) => onUpdate({ sfxOn: v })}
            />
            <SettingRow
              icon={<Layout size={20} />}
              label={t.hints}
              value={playerData.showHints}
              onChange={(v) => onUpdate({ showHints: v })}
            />
            <SettingRow
              icon={<Undo2 size={20} />}
              label={t.undo}
              value={playerData.undoEnabled}
              onChange={(v) => onUpdate({ undoEnabled: v })}
            />
            <SettingRow
              icon={<Settings2 size={20} />}
              label="Low Graphics Mode"
              value={playerData.lowGraphics || false}
              onChange={(v) => onUpdate({ lowGraphics: v, graphicsPreferenceSet: true })}
            />
            {!import.meta.env.PROD && (
              <SettingRow
                icon={<Info size={20} />}
                label="Performance Overlay"
                value={playerData.showDebugOverlay || false}
                onChange={(v) => onUpdate({ showDebugOverlay: v })}
              />
            )}


            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[#d9ad33]"><Layout size={20} /></div>
                  <span className="text-white text-lg font-medium tracking-wide">{(t as any).preferredSide || "Preferred Side"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onUpdate({ preferredSide: 'w' })}
                  className={`py-3 px-4 rounded-xl font-bold tracking-wider transition-all border flex items-center justify-center gap-3 ${
                    playerData.preferredSide === 'w' 
                      ? "bg-[#d9ad33] text-black border-[#d9ad33]" 
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border ${playerData.preferredSide === 'w' ? 'bg-white border-black/20' : 'bg-white border-white/20'}`} />
                  WHITE
                </button>
                <button
                  onClick={() => onUpdate({ preferredSide: 'b' })}
                  className={`py-3 px-4 rounded-xl font-bold tracking-wider transition-all border flex items-center justify-center gap-3 ${
                    playerData.preferredSide === 'b' 
                      ? "bg-[#d9ad33] text-black border-[#d9ad33]" 
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border ${playerData.preferredSide === 'b' ? 'bg-black border-white/20' : 'bg-black border-white/20'}`} />
                  BLACK
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[#d9ad33]"><Globe size={20} /></div>
                  <span className="text-white text-lg font-medium tracking-wide">{t.language}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['en', 'hi', 'ur', 'ar'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onUpdate({ language: lang })}
                    className={`py-3 px-4 rounded-xl font-bold tracking-wider transition-all border ${
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
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[#d9ad33]"><Settings2 size={20} /></div>
                  <span className="text-white text-lg font-medium tracking-wide">{t.cameraSensitivity}</span>
                </div>
                <span className="text-[#d9ad33] font-mono text-sm">{(playerData.cameraSensitivity || 1).toFixed(1)}x</span>
              </div>
              <input 
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={playerData.cameraSensitivity || 1}
                onChange={(e) => onUpdate({ cameraSensitivity: parseFloat(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d9ad33]"
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-[#d9ad33]"><Type size={20} /></div>
                  <span className="text-white text-lg font-medium tracking-wide">{t.fontSize}</span>
                </div>
                <span className="text-[#d9ad33] font-mono text-sm">{(playerData.fontSize || 1).toFixed(1)}x</span>
              </div>
              <input 
                type="range"
                min="0.8"
                max="1.5"
                step="0.1"
                value={playerData.fontSize || 1}
                onChange={(e) => onUpdate({ fontSize: parseFloat(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d9ad33]"
              />
            </div>

            <div className="mt-6 p-6 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 text-[#d9ad33] mb-3">
                <Info size={18} />
                <h3 className="font-bold tracking-wider text-sm uppercase">Court Etiquette</h3>
              </div>
              <p className="text-[#8c7a52] text-xs leading-relaxed tracking-wide">
                Right-drag to rotate the board. Scroll to zoom in on the battlefield. 
                Use keys 1 and 2 to switch between strategic viewpoints.
              </p>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[#8c7a52] text-[10px] tracking-[0.3em] uppercase font-bold">Version 1.0 | Clash of Crowns</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, value, onChange }: { icon: React.ReactNode, label: string, value: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className="text-[#d9ad33] group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-white text-lg font-medium tracking-wide">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
          value ? "bg-[#d9ad33]" : "bg-white/10"
        }`}
      >
        <motion.div
          animate={{ x: value ? 32 : 4 }}
          className={`absolute top-1 w-6 h-6 rounded-full shadow-lg ${
            value ? "bg-black" : "bg-[#8c7a52]"
          }`}
        />
      </button>
    </div>
  );
}

