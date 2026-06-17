import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Award, Target, Star, Zap, Shield, Crown } from 'lucide-react';
import { PlayerData } from '../../types';

interface GooglePlayGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerData: PlayerData;
}

const ACHIEVEMENTS = [
  { id: 1, title: "First Blood", desc: "Win your first match", icon: Target, xp: 500, unlocked: true },
  { id: 2, title: "Strategist", desc: "Reach Learner tier", icon: Award, xp: 1000, unlocked: true },
  { id: 3, title: "Grandmaster", desc: "Reach the ultimate rank", icon: Crown, xp: 5000, unlocked: false },
  { id: 4, title: "Unstoppable", desc: "Win 5 games in a row", icon: Zap, xp: 2000, unlocked: false },
  { id: 5, title: "Veteran", desc: "Play 100 matches", icon: Shield, xp: 1500, unlocked: true },
  { id: 6, title: "Star Player", desc: "Earn 1000 rating points", icon: Star, xp: 2500, unlocked: false },
];

export default function GooglePlayGamesModal({ isOpen, onClose, playerData }: GooglePlayGamesModalProps) {
  const [activeTab, setActiveTab] = React.useState<'achievements' | 'leaderboard'>('achievements');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#030204]/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-[#111114] border border-[#323238] rounded-3xl overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="bg-[#1a1a1e] p-6 flex items-center justify-between border-b border-[#323238]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#34A853] rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold tracking-wider">Google Play Games</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[#524e48] text-[10px] uppercase tracking-widest font-bold">Level 12</span>
                    <div className="w-24 h-1 bg-[#323238] rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-[#34A853]" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={20} className="text-[#524e48]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#323238]">
              <button
                onClick={() => setActiveTab('achievements')}
                className={`flex-1 py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${
                  activeTab === 'achievements' ? 'text-[#34A853] border-b-2 border-[#34A853]' : 'text-[#524e48] hover:text-white'
                }`}
              >
                Achievements
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-4 text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${
                  activeTab === 'leaderboard' ? 'text-[#34A853] border-b-2 border-[#34A853]' : 'text-[#524e48] hover:text-white'
                }`}
              >
                Leaderboards
              </button>
            </div>

            {/* Content */}
            <div className="p-6 h-[400px] overflow-y-auto custom-scrollbar">
              {activeTab === 'achievements' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ACHIEVEMENTS.map((ach) => (
                    <div 
                      key={ach.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        ach.unlocked 
                          ? 'bg-[#1a1a1e] border-[#323238]' 
                          : 'bg-[#09090b] border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          ach.unlocked ? 'bg-[#34A853]/20 text-[#34A853]' : 'bg-white/5 text-[#524e48]'
                        }`}>
                          <ach.icon size={24} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-white text-sm font-bold">{ach.title}</h4>
                          <p className="text-[#524e48] text-[10px]">{ach.desc}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[#34A853] text-[10px] font-bold">{ach.xp} XP</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((rank) => (
                    <div 
                      key={rank}
                      className={`p-4 rounded-2xl flex items-center gap-4 ${
                        rank === 1 ? 'bg-[#34A853]/10 border border-[#34A853]/20' : 'bg-[#1a1a1e]'
                      }`}
                    >
                      <span className={`w-6 text-center font-bold ${
                        rank === 1 ? 'text-[#f5d666]' : 'text-[#524e48]'
                      }`}>#{rank}</span>
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="flex-1">
                        <span className="text-white text-sm font-bold">Player_{rank * 123}</span>
                        <div className="text-[#524e48] text-[10px] uppercase tracking-widest">Grandmaster</div>
                      </div>
                      <span className="text-[#34A853] font-mono font-bold">2,450</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#1a1a1e] p-4 flex items-center justify-center border-t border-[#323238]">
              <span className="text-[8px] text-[#524e48] uppercase tracking-[0.3em]">Connected as {playerData.name}</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
