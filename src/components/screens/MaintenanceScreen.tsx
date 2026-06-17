import React from 'react';
import { motion } from 'motion/react';
import { VersionGateConfig } from '../../lib/version/versionGateTypes';

interface MaintenanceScreenProps {
  config: VersionGateConfig | null;
  onRetry: () => void;
}

export default function MaintenanceScreen({ config, onRetry }: MaintenanceScreenProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#030204] text-white p-8 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#120e16] border border-[#d9ad33]/30 rounded-2xl p-8 text-center"
      >
        <div className="text-[#d9ad33] mb-4 flex justify-center">
          <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-[#d9ad33] mb-4 tracking-wider">Maintenance Mode</h1>
        
        <p className="text-white/80 mb-8 text-lg">
          {config?.message || "We are currently performing scheduled maintenance. Please check back later."}
        </p>

        <button
          onClick={onRetry}
          className="w-full py-4 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 active:scale-95 transition-all text-lg border border-white/20"
        >
          Retry
        </button>
      </motion.div>
    </div>
  );
}
