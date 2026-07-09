import React, { useState } from 'react';
import { APP_INFO } from '../../config/appInfo';
import { Info, ShieldAlert } from 'lucide-react';
import { playSound } from '../../lib/sounds';

export default function AboutPanel() {
  const [showLicenses, setShowLicenses] = useState(false);

  return (
    <div className="flex flex-col gap-5 w-full text-white text-xs">
      {/* App details card */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-3.5 relative overflow-hidden">
        {/* Subtle accent corner */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-[#d9ad33]/5 rounded-bl-full border-b border-l border-[#d9ad33]/10" />

        <div className="flex items-center gap-3">
          <Info size={16} className="text-[#d9ad33]" />
          <span className="font-serif font-bold text-sm tracking-wider uppercase text-white/90">Software Information</span>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 pt-2 border-t border-white/5">
          <span className="text-[#8c7a52] uppercase font-bold tracking-wider">Application:</span>
          <span className="text-white/90 font-medium">{APP_INFO.name}</span>

          <span className="text-[#8c7a52] uppercase font-bold tracking-wider">Version:</span>
          <span className="text-white/90 font-medium">{APP_INFO.version} (code {APP_INFO.versionCode})</span>

          <span className="text-[#8c7a52] uppercase font-bold tracking-wider">Package ID:</span>
          <span className="text-white/60 font-mono break-all">{APP_INFO.packageId}</span>

          <span className="text-[#8c7a52] uppercase font-bold tracking-wider">Build Hash:</span>
          <span className="text-white/50 font-mono break-all text-[10px]">{APP_INFO.buildHash}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => { playSound('click'); setShowLicenses(!showLicenses); }}
          className={`px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-xl transition-all border ${
            showLicenses ? 'bg-[#d9ad33] text-black border-[#d9ad33]' : 'bg-white/5 text-white border-white/10'
          }`}
        >
          {showLicenses ? 'Hide Open Source Licenses' : 'View Open Source Licenses'}
        </button>

        {showLicenses && (
          <div className="p-4 bg-black/50 border border-white/10 rounded-xl text-[10px] text-white/60 max-h-[140px] overflow-y-auto leading-relaxed flex flex-col gap-2.5 font-mono">
            <div>
              <span className="text-white font-bold block mb-0.5">React / React DOM</span>
              <span>MIT License. Copyright (c) Meta Platforms, Inc. and affiliates.</span>
            </div>
            <div>
              <span className="text-white font-bold block mb-0.5">Three.js / Fiber / Drei</span>
              <span>MIT License. Copyright (c) 2010-2026 three.js authors.</span>
            </div>
            <div>
              <span className="text-white font-bold block mb-0.5">Lucide React Icons</span>
              <span>ISC License. Copyright (c) Lucide Contributors.</span>
            </div>
            <div>
              <span className="text-white font-bold block mb-0.5">CryptoJS</span>
              <span>MIT License. Copyright (c) 2009-2013 Jeff Mott.</span>
            </div>
          </div>
        )}
      </div>

      {/* Copyright footer */}
      <div className="text-center pt-3 text-[10px] text-[#8c7a52] uppercase tracking-[0.2em] font-bold">
        {APP_INFO.copyright}
      </div>
    </div>
  );
}
