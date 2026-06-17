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
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[100] pointer-events-none flex flex-col items-center gap-1"
        >
          <div className="bg-black/90 backdrop-blur-md border border-[#d9ad33]/40 px-4 py-2.5 rounded-xl max-w-[280px] md:max-w-[360px] text-center shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_15px_rgba(217,173,51,0.15)] pointer-events-auto">
            <span className="block text-[8px] md:text-[9px] text-[#8c7a52] font-black uppercase tracking-[0.2em] mb-0.5">
              {characterName}
            </span>
            <p className="text-[11px] md:text-[13px] text-[#e2ddd4] font-medium leading-relaxed italic font-sans">
              "{reaction.text}"
            </p>
          </div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/90" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
