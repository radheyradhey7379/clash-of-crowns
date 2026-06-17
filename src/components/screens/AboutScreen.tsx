import React from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft, Info } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';

interface AboutScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

export default function AboutScreen({ onNavigate, playerData }: AboutScreenProps) {
  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-20 flex items-center justify-between px-8 z-10">
        <motion.button
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-[#d9ad33]/20 text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-colors"
          title="Back to Court"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <div className="flex items-center gap-3">
          <Info size={24} className="text-[#d9ad33]" />
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">ABOUT</h1>
        </div>
        <div className="w-32" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-10 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/40 backdrop-blur-2xl border border-white/10 p-12 rounded-3xl max-w-3xl w-full text-center relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#d9ad33]" />
          
          <h2 className="text-5xl font-bold text-[#d9ad33] font-serif tracking-[0.2em] mb-4 uppercase">CLASH OF CROWNS</h2>
          <p className="text-xl text-[#b38f42] tracking-[0.4em] mb-10 font-bold uppercase">Reign Supreme</p>
          
          <div className="h-px bg-white/10 mb-10" />
          
          <div className="flex flex-col gap-6 text-white/70 text-lg tracking-wide">
            <p>A 3D chess progression game designed for the elite.</p>
            <p>Fight through six tiers of increasingly powerful opponents, each with their own unique strategy and standing.</p>
            <p>From a humble <span className="text-[#d9ad33] font-bold">Beginner Cadet</span> to the legendary <span className="text-[#f5d666] font-bold">Grandmaster</span>.</p>
            <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-2">
              <p className="text-[#8c7a52] text-[10px] font-bold tracking-[0.3em] uppercase">Version 1.0</p>
              <p className="text-[#52452a] text-[9px] font-bold tracking-[0.2em] uppercase">Built with React & Three.js</p>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#d9ad33]/5 rounded-full blur-3xl" />
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#d9ad33]/5 rounded-full blur-3xl" />
        </motion.div>
      </div>
    </div>
  );
}

