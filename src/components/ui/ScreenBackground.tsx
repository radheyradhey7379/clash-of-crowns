import React from 'react';
import { PlayerData } from '../../types';

interface ScreenBackgroundProps {
  playerData: PlayerData;
  opacity?: number;
}

export default function ScreenBackground({ playerData, opacity = 0.3 }: ScreenBackgroundProps) {
  const homeAnim = playerData.homeAnimation || 'bg1.mp4';
  const animPath = homeAnim.startsWith('/') ? homeAnim : `/${homeAnim}`;

  return (
    <div className="absolute inset-0 z-0 bg-[#000]">
      <video
        key={animPath}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover home-background"
        style={{ opacity }}
      >
        <source src={animPath} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
    </div>
  );
}
