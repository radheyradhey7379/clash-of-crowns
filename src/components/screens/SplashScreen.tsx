import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Package, Database, Shield, Zap, Globe, Cpu } from 'lucide-react';

const LOADING_STEPS = [
  { icon: Package, text: "Initializing Game Engine..." },
  { icon: Database, text: "Fetching Assets..." },
  { icon: Shield, text: "Verifying Protocols..." },
  { icon: Cpu, text: "Optimizing AI..." },
  { icon: Globe, text: "Syncing Data..." },
  { icon: Zap, text: "Ready to Launch!" }
];

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [phase, setPhase] = useState<'crown' | 'credits'>('crown');

  useEffect(() => {
    // Phase 1: Crown Animation
    const crownTimer = setTimeout(() => {
      setPhase('credits');
    }, 2500);

    return () => clearTimeout(crownTimer);
  }, []);

  useEffect(() => {
    if (phase === 'credits') {
      const timer = setTimeout(() => {
        onFinish();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [phase, onFinish]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#030204] relative overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 'crown' ? (
          <motion.div
            key="crown-phase"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2, filter: 'blur(10px)' }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="relative">
              <motion.div
                animate={{ 
                  boxShadow: ["0 0 20px rgba(217,173,51,0.2)", "0 0 60px rgba(217,173,51,0.4)", "0 0 20px rgba(217,173,51,0.2)"] 
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 bg-gradient-to-br from-[#f5d666] to-[#d9ad33] rounded-[2.5rem] flex items-center justify-center relative z-10"
              >
                <Crown size={64} className="text-[#030204]" />
              </motion.div>
              <div className="absolute inset-0 bg-[#d9ad33] blur-[80px] opacity-20 animate-pulse" />
            </div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 font-serif text-3xl text-[#f5d666] tracking-[0.3em] uppercase"
            >
              Clash of Crowns
            </motion.h1>
          </motion.div>
        ) : (
          <motion.div
            key="credits-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center gap-8"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-[#8c7a52] text-[10px] tracking-[0.4em] uppercase mb-2">Developed by</p>
              <h2 className="text-white text-xl font-serif tracking-widest uppercase">Abhijat & Tripuresh Team</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              <p className="text-[#8c7a52] text-[10px] tracking-[0.4em] uppercase mb-2">Sound & Music by</p>
              <h2 className="text-white text-xl font-serif tracking-widest uppercase">Krishna</h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="mt-4"
            >
              <div className="w-12 h-0.5 bg-[#d9ad33] mx-auto rounded-full opacity-50" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
