import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Shield, Swords } from 'lucide-react';
import { playSound } from '../../lib/sounds';

interface LocalGameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: { player1: string; player2: string; player1Color: 'w' | 'b' }) => void;
}

export default function LocalGameSetupModal({ isOpen, onClose, onStart }: LocalGameSetupModalProps) {
  const [player1, setPlayer1] = useState('Player 1');
  const [player2, setPlayer2] = useState('Player 2');
  const [player1Color, setPlayer1Color] = useState<'w' | 'b'>('w');

  const handleStart = () => {
    playSound('click');
    onStart({ player1, player2, player1Color });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-[#09090b] border-2 border-[#d9ad33]/30 w-full max-w-md p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(217,173,51,0.15)] local-setup-modal-panel"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-[#d9ad33]/10 rounded-full flex items-center justify-center mb-4 border border-[#d9ad33]/20">
                <Swords size={32} className="text-[#d9ad33]" />
              </div>
              <h2 className="text-2xl font-bold text-[#d9ad33] font-serif tracking-[0.3em] uppercase">
                LOCAL BATTLE
              </h2>
              <p className="text-[#8c7a52] text-[10px] tracking-[0.2em] uppercase mt-1">Configure your duel</p>
            </div>

            <div className="space-y-6">
              {/* Player 1 */}
              <div className="space-y-2">
                <label className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase flex items-center gap-2">
                  <User size={12} /> Player 1 (White)
                </label>
                <input
                  type="text"
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d9ad33] transition-colors font-serif"
                  placeholder="Enter Name"
                />
              </div>

              {/* Player 2 */}
              <div className="space-y-2">
                <label className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase flex items-center gap-2">
                  <User size={12} /> Player 2 (Black)
                </label>
                <input
                  type="text"
                  value={player2}
                  onChange={(e) => setPlayer2(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d9ad33] transition-colors font-serif"
                  placeholder="Enter Name"
                />
              </div>

              {/* Color Choice (Optional, user asked for it but usually P1 is White in local) */}
              <div className="space-y-3">
                <label className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase block text-center">
                  Who plays White?
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => { playSound('click'); setPlayer1Color('w'); }}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${player1Color === 'w' ? 'border-[#d9ad33] bg-[#d9ad33]/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-300" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{player1}</span>
                  </button>
                  <button
                    onClick={() => { playSound('click'); setPlayer1Color('b'); }}
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${player1Color === 'b' ? 'border-[#d9ad33] bg-[#d9ad33]/10' : 'border-white/5 bg-white/5 opacity-50'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-300" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{player2}</span>
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStart}
                className="w-full py-4 bg-gradient-to-r from-[#d9ad33] to-[#8c661a] text-black font-bold tracking-[0.3em] rounded-2xl shadow-xl hover:brightness-110 transition-all uppercase mt-4"
              >
                START BATTLE
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
