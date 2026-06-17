import React from 'react';
import { motion } from 'motion/react';
import { VersionGateConfig } from '../../lib/version/versionGateTypes';
import { Capacitor } from '@capacitor/core';

interface ForceUpdateScreenProps {
  config: VersionGateConfig | null;
}

export default function ForceUpdateScreen({ config }: ForceUpdateScreenProps) {
  const handleUpdate = () => {
    if (config?.playStoreUrl) {
      if (Capacitor.isNativePlatform()) {
        // Attempt native intent or fallback
        window.location.href = config.playStoreUrl;
      } else {
        window.open(config.playStoreUrl, '_blank');
      }
    } else {
      // Safe fallback if URL missing
      alert("Please visit the App Store or Play Store to update Clash of Crowns.");
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#030204] text-white p-8 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#120e16] border border-[#d9ad33]/30 rounded-2xl p-8 text-center"
      >
        <h1 className="text-3xl font-bold text-[#d9ad33] mb-4 tracking-wider">Update Required</h1>
        
        <p className="text-white/80 mb-6 text-lg">
          {config?.message || "A new mandatory update is available. Please update to continue playing."}
        </p>

        {config?.latestVersion && (
          <div className="mb-8 text-sm text-white/50">
            Latest Version: <span className="text-[#d9ad33]">{config.latestVersion}</span>
          </div>
        )}

        <button
          onClick={handleUpdate}
          className="w-full py-4 bg-gradient-to-r from-[#d9ad33] to-[#b38d22] text-black font-bold rounded-full hover:brightness-110 active:scale-95 transition-all text-lg shadow-[0_0_15px_rgba(217,173,51,0.3)]"
        >
          Update Now
        </button>
      </motion.div>
    </div>
  );
}
