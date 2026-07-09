import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS, TIER_KEYS } from '../../types';
import { ChevronLeft, Lock, Play, Users, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/translations';
import ScreenBackground from '../ui/ScreenBackground';
import { loadGameState } from '../../lib/store';
import { isCharacterUnlocked, isCharacterCurrent } from '../../game/ai/progressionEngine';
import { AI_CHARACTERS } from '../../game/ai/aiCharacters';

interface LevelSelectScreenProps {
  onNavigate: (screen: AppScreen, level?: any, localConfig?: any) => void;
  playerData: PlayerData;
  onSelectLevel: (characterId: string) => void;
}

export default function LevelSelectScreen({ onNavigate, playerData, onSelectLevel }: LevelSelectScreenProps) {
  // Try to find the index of the player's current tier
  const initialTierIndex = Math.max(0, TIER_KEYS.indexOf(playerData.aiProgress?.tier || 'beginner'));
  const [activeTierIdx, setActiveTierIdx] = useState(initialTierIndex);
  const [savedGame, setSavedGame] = useState<any>(null);
  const t = useTranslation(playerData.language || 'en');
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';

  useEffect(() => {
    setSavedGame(loadGameState());
  }, []);

  const activeTierKey = TIER_KEYS[activeTierIdx];
  const charactersInTier = AI_CHARACTERS.filter(c => c.tier === activeTierKey);

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div 
        className="h-20 flex items-center justify-between z-10"
        style={{
          paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
          paddingRight: 'calc(2rem + env(safe-area-inset-right))',
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))'
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05, x: isRtl ? 5 : -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-white/10 hover:bg-white/10 transition-all text-[#8c7a52] hover:text-[#d9ad33]"
          title={t.back}
        >
          <ChevronLeft size={20} className={isRtl ? "rotate-180" : ""} />
        </motion.button>
        <div className="flex items-center gap-3">
          <Users size={24} className="text-[#d9ad33]" />
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">{t.selectLevel}</h1>
        </div>
        <div className="w-10" />
      </div>

      {/* Tier Tabs (Horizontal Scroll for 8 tabs) */}
      <div 
        className="flex w-full h-14 bg-black/60 backdrop-blur-xl border-b border-white/5 z-10 overflow-x-auto hide-scrollbar scroll-smooth whitespace-nowrap"
        style={{
          paddingLeft: 'calc(1.5rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1.5rem + env(safe-area-inset-right))'
        }}
      >
        <div className="flex min-w-full md:justify-center px-4 h-full">
          {TIER_LABELS.map((label, i) => {
            return (
              <button
                key={label}
                onClick={() => setActiveTierIdx(i)}
                className={cn(
                  "inline-flex flex-col items-center justify-center min-w-[90px] md:min-w-[130px] lg:min-w-[160px] px-3 md:px-6 text-[10px] md:text-xs font-bold tracking-[0.2em] transition-all relative uppercase flex-shrink-0 h-full",
                  activeTierIdx === i 
                    ? "text-[#d9ad33]" 
                    : "text-white/20 hover:text-white/40"
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 opacity-20" style={{ backgroundColor: TIER_COLORS[i] }} />
                <span className="truncate w-full">{label}</span>
                {activeTierIdx === i && (
                  <motion.div 
                    layoutId="tier-tab" 
                    className="absolute bottom-0 left-0 w-full h-0.5" 
                    style={{ backgroundColor: TIER_COLORS[i] }} 
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Character Grid */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-10 z-10 custom-scrollbar"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {/* Render Master Cups differently */}
        {activeTierKey === 'master' ? (
          <div className="max-w-7xl mx-auto flex flex-col gap-8">
            {[1, 2, 3].map(cup => (
               <div key={cup}>
                 <h2 className="text-xl text-[#d9ad33] font-bold uppercase mb-4 tracking-[0.3em] font-serif border-b border-[#d9ad33]/20 pb-2">Master Cup {cup}</h2>
                 <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                    {charactersInTier.filter(c => c.cup === cup).map(char => (
                      <CharacterCard 
                        key={char.id} 
                        character={char} 
                        playerData={playerData}
                        savedGame={savedGame}
                        activeTierIdx={activeTierIdx}
                        onSelectLevel={onSelectLevel}
                        t={t}
                      />
                    ))}
                 </div>
               </div>
            ))}
          </div>
        ) : activeTierKey === 'grandmaster' ? (
          <div className="max-w-7xl mx-auto flex flex-col gap-8">
             <div>
                <h2 className="text-xl text-[#d9ad33] font-bold uppercase mb-4 tracking-[0.3em] font-serif border-b border-[#d9ad33]/20 pb-2">Ultimate Challenge</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 md:gap-6">
                  {charactersInTier.filter(c => c.level === 1).map(char => (
                    <CharacterCard 
                      key={char.id} 
                      character={char} 
                      playerData={playerData}
                      savedGame={savedGame}
                      activeTierIdx={activeTierIdx}
                      onSelectLevel={onSelectLevel}
                      t={t}
                    />
                  ))}
                </div>
             </div>
             <div>
                <h2 className="text-xl text-[#d9ad33] font-bold uppercase mb-4 tracking-[0.3em] font-serif border-b border-[#d9ad33]/20 pb-2">Prestige Modes</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 md:gap-6">
                  {charactersInTier.filter(c => c.level > 1).map(char => (
                    <CharacterCard 
                      key={char.id} 
                      character={char} 
                      playerData={playerData}
                      savedGame={savedGame}
                      activeTierIdx={activeTierIdx}
                      onSelectLevel={onSelectLevel}
                      t={t}
                    />
                  ))}
                </div>
             </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {charactersInTier.map((char) => (
               <CharacterCard 
                  key={char.id} 
                  character={char} 
                  playerData={playerData}
                  savedGame={savedGame}
                  activeTierIdx={activeTierIdx}
                  onSelectLevel={onSelectLevel}
                  t={t}
               />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, playerData, savedGame, activeTierIdx, onSelectLevel, t }: any) {
  const unlocked = isCharacterUnlocked(character.id, playerData.aiProgress);
  const isCurrent = isCharacterCurrent(character.id, playerData.aiProgress);
  const charRating = character.eloTarget;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={unlocked ? { scale: 1.02, y: -3 } : {}}
      whileTap={unlocked ? { scale: 0.98 } : {}}
      onClick={() => unlocked && onSelectLevel(character.id)}
      className={cn(
        "relative h-28 sm:h-32 md:h-36 lg:h-44 rounded-2xl border flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all shadow-xl group p-3 text-center",
        isCurrent ? "bg-[#d9ad33]/10 border-[#d9ad33] shadow-[#d9ad33]/20" : 
        unlocked ? "bg-black/40 border-white/10 hover:border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.4)]" : 
        "bg-black/60 border-white/5 opacity-40 cursor-not-allowed"
      )}
    >
      <div className="absolute top-0 left-0 w-full h-1.5 opacity-40" style={{ backgroundColor: TIER_COLORS[activeTierIdx] }} />
      
      <h3 className={cn("text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-0.5 sm:mb-1 font-serif tracking-wide", unlocked ? "text-white" : "text-white/40")}>
        {character.name}
      </h3>
      <p className="text-[9px] sm:text-[10px] md:text-xs text-[#8c7a52] font-bold tracking-widest uppercase">{t.rating}: {charRating}</p>

      <div className="mt-2 sm:mt-4 flex items-center gap-2">
        {isCurrent ? (
          <div className="flex flex-col gap-2 w-full px-2">
            {savedGame && savedGame.selectedCharacterId === character.id ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLevel(character.id);
                }}
                className="w-full px-4 py-1.5 bg-[#d9ad33] text-black text-[8px] font-bold tracking-[0.2em] rounded-full uppercase flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={8} />
                <span>Resume</span>
              </motion.button>
            ) : (
              <div className="w-full px-4 py-1.5 bg-[#d9ad33] text-black text-[8px] font-bold tracking-[0.2em] rounded-full uppercase text-center">
                Current
              </div>
            )}
          </div>
        ) : unlocked ? (
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-white text-[8px] font-bold tracking-[0.2em] group-hover:bg-white/10 transition-all uppercase">
            {savedGame && savedGame.selectedCharacterId === character.id ? (
              <>
                <RotateCcw size={8} />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Play size={8} fill="currentColor" />
                <span>Replay</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-black/20 rounded-full text-white/30 text-[8px] font-bold tracking-[0.2em] uppercase">
            <Lock size={8} />
            <span>Locked</span>
          </div>
        )}
      </div>

      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
