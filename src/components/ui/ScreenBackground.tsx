import React from 'react';
import { Capacitor } from '@capacitor/core';
import { PlayerData } from '../../types';

interface ScreenBackgroundProps {
  playerData: PlayerData;
  opacity?: number;
}

export default function ScreenBackground({ playerData, opacity = 0.3 }: ScreenBackgroundProps) {
  const isMobile = Capacitor.isNativePlatform() || (
    typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent)
  );

  return (
    <div className="absolute inset-0 z-0 bg-[#000]">
      <img 
        src="/home-bg-mobile.webp" 
        alt="Background" 
        className="w-full h-full object-cover home-background"
        style={{ opacity }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
    </div>
  );
}
