import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VersionGateConfig } from '../../lib/version/versionGateTypes';
import { Capacitor } from '@capacitor/core';

interface SoftUpdateNoticeProps {
  config: VersionGateConfig | null;
  onDismiss: () => void;
}

export default function SoftUpdateNotice({ config, onDismiss }: SoftUpdateNoticeProps) {
  const handleUpdate = () => {
    if (config?.playStoreUrl) {
      if (Capacitor.isNativePlatform()) {
        window.location.href = config.playStoreUrl;
      } else {
        window.open(config.playStoreUrl, '_blank');
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-safe left-0 right-0 z-40 p-4 flex justify-center pointer-events-none"
      >
        <div className="bg-[#1a1423] border border-[#d9ad33]/30 rounded-xl p-4 flex items-center justify-between shadow-2xl max-w-lg w-full pointer-events-auto">
          <div className="flex-1 mr-4">
            <h3 className="text-[#d9ad33] font-bold text-sm mb-1">Update Available</h3>
            <p className="text-white/80 text-xs">
              {config?.message || "A new version of Clash of Crowns is available."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="px-4 py-2 text-white/50 text-xs hover:text-white transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-[#d9ad33] text-black font-bold text-xs rounded hover:bg-[#f5d666] transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
