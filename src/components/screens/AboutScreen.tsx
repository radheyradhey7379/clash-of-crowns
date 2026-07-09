import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft, Info } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';
import { playSound } from '../../lib/sounds';
import { APP_INFO } from '../../config/appInfo';

interface AboutScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

const LICENSES = [
  { name: 'React / React DOM', license: 'MIT License', author: 'Meta Platforms' },
  { name: 'Three.js / Fiber / Drei', license: 'MIT License', author: 'Three.js Authors' },
  { name: 'Lucide React Icons', license: 'ISC License', author: 'Lucide Contributors' },
  { name: 'Framer Motion', license: 'MIT License', author: 'Framer B.V.' },
  { name: 'chess.js', license: 'BSD-2 License', author: 'Jeff Hlywa' },
];

export default function AboutScreen({ onNavigate, playerData }: AboutScreenProps) {
  const [showLicenses, setShowLicenses] = useState(false);

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#030204] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between z-10 w-full px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('click'); onNavigate('Settings'); }}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#d9ad33]">
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-lg font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">About</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 w-full overflow-y-auto z-10" style={{
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
      }}>
        <div className="max-w-2xl w-full mx-auto flex flex-col gap-5 pt-2 pb-8">

          {/* App Info Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#d9ad33]" />
            <div className="flex items-center gap-3 mb-5">
              <Info size={22} className="text-[#d9ad33]" />
              <h2 className="text-[#d9ad33] text-base font-bold tracking-[0.15em] font-serif uppercase">
                {APP_INFO.name}
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[#8c7a52] text-xs uppercase tracking-wider font-bold">Version</span>
                <span className="text-white text-sm font-mono">
                  {APP_INFO.version} <span className="text-[#8c7a52] text-xs">(code {APP_INFO.versionCode})</span>
                </span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between">
                <span className="text-[#8c7a52] text-xs uppercase tracking-wider font-bold">Copyright</span>
                <span className="text-white/70 text-xs">{APP_INFO.copyright}</span>
              </div>
            </div>
          </div>

          {/* Open Source Licenses */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => { playSound('click'); setShowLicenses(!showLicenses); }}
              className="w-full flex items-center justify-between py-4 px-5 text-left"
            >
              <span className="text-white text-sm font-semibold tracking-wide">Open Source Licenses</span>
              <span className="text-[#8c7a52] text-xs font-bold uppercase tracking-wider">
                {showLicenses ? 'Hide' : 'Show'}
              </span>
            </button>
            {showLicenses && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-5 pb-5"
              >
                <div className="border-t border-white/5 pt-4 flex flex-col gap-3">
                  {LICENSES.map((lib) => (
                    <div key={lib.name} className="flex flex-col gap-0.5">
                      <span className="text-white text-xs font-semibold">{lib.name}</span>
                      <span className="text-[#8c7a52] text-[11px]">
                        {lib.license} — {lib.author}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Copyright Footer */}
          <div className="text-center mt-4">
            <p className="text-[#8c7a52] text-[10px] font-bold tracking-[0.2em] uppercase">
              {APP_INFO.copyright}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
