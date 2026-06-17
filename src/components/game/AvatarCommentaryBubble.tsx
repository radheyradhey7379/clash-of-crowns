import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CommentaryReaction } from '../../game/commentary/commentaryTypes';

interface AvatarCommentaryBubbleProps {
  reaction: CommentaryReaction | null;
  onClose: () => void;
  characterName?: string;
}

export default function AvatarCommentaryBubble({
  reaction,
  onClose,
  characterName = 'Opponent'
}: AvatarCommentaryBubbleProps) {
  useEffect(() => {
    if (!reaction) return;

    const timer = setTimeout(() => {
      onClose();
    }, reaction.durationMs);

    return () => clearTimeout(timer);
  }, [reaction, onClose]);

  return (
    <AnimatePresence>
      {reaction && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed bottom-[95px] left-1/2 -translate-x-1/2 md:bottom-24 md:right-6 md:left-auto md:translate-x-0 z-[100] pointer-events-none flex items-center gap-3 w-max max-w-[90vw] md:max-w-sm"
        >
          <div className="bg-[#0c0a0e]/95 backdrop-blur-md border border-[#d9ad33]/40 p-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_15px_rgba(217,173,51,0.15)] pointer-events-auto">
            {/* Rounded Avatar Area with DiceBear SVG */}
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#f5d666]/10 to-[#d9ad33]/15 border border-[#d9ad33]/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
              <img 
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${characterName}`} 
                alt={characterName} 
                className="w-8 h-8 md:w-10 md:h-10"
              />
            </div>
            
            <div className="flex flex-col items-start text-left">
              <span className="block text-[8px] md:text-[9px] text-[#d9ad33] font-black uppercase tracking-[0.2em] mb-0.5">
                {characterName}
              </span>
              <p className="text-[10px] md:text-[12px] text-[#e2ddd4] font-medium leading-relaxed italic font-sans max-w-[180px] md:max-w-[240px]">
                "{reaction.text}"
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
