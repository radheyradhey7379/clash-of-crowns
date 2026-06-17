import React from 'react';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';

interface GameLoadingScreenProps {
  progress: number;
  message?: string;
}

export default function GameLoadingScreen({ progress, message = 'Initializing game...' }: GameLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#030204] text-white">
      {/* Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#d9ad33]/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d9ad33]/5 blur-[120px] rounded-full animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 flex flex-col items-center max-w-sm w-full px-6 text-center"
      >
        {/* Crown Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#f5d666] to-[#d9ad33] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(217,173,51,0.2)] mb-6 animate-bounce">
          <Crown className="text-[#030204] w-8 h-8" />
        </div>

        {/* Title */}
        <h2 className="font-serif text-lg tracking-[0.2em] uppercase text-[#f5d666] mb-1">
          Entering Battlefield
        </h2>
        <p className="text-[#524e48] font-serif tracking-widest uppercase text-[9px] mb-8">
          Clash of Crowns
        </p>

        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-white/5 border border-white/10 rounded-full overflow-hidden mb-3">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#d9ad33] to-[#f5d666]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
          />
        </div>

        {/* Status Text */}
        <div className="flex justify-between w-full text-[9px] uppercase tracking-widest text-white/40 font-bold font-sans">
          <span>{message}</span>
          <span className="text-[#f5d666]">{progress}%</span>
        </div>
      </motion.div>
    </div>
  );
}
