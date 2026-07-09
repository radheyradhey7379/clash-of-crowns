import React, { useState } from 'react';
import { PlayerData } from '../../types';

interface ScreenBackgroundProps {
  playerData: PlayerData;
  opacity?: number;
}

export default function ScreenBackground({ playerData, opacity = 0.3 }: ScreenBackgroundProps) {
  const [isReady, setIsReady] = useState(false);
  
  let homeAnim = playerData.homeAnimation || 'bg1.mp4';
  
  // Fallback for old/existing users who have deleted animations stored in their preferences
  if (
    homeAnim === 'homeanimation.mp4' || 
    homeAnim === 'homeanimation2.mp4' || 
    homeAnim === '/homeanimation.mp4' || 
    homeAnim === '/homeanimation2.mp4'
  ) {
    homeAnim = 'bg1.mp4';
  }
  
  const animPath = homeAnim.startsWith('/') ? homeAnim : `/${homeAnim}`;

  return (
    <div className="absolute inset-0 z-0 bg-[#000]">
      {/* Inject custom CSS rules to completely hide Android WebView and iOS Safari media play button overlays */}
      <style>{`
        video::-webkit-media-controls {
          display: none !important;
        }
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
          -webkit-appearance: none;
        }
        video::-webkit-media-controls-panel {
          display: none !important;
          -webkit-appearance: none;
        }
        video::-webkit-media-controls-play-button {
          display: none !important;
          -webkit-appearance: none;
        }
        video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none;
        }
      `}</style>
      <video
        key={animPath}
        autoPlay
        muted
        loop
        playsInline
        webkit-playsinline="true"
        onPlaying={() => setIsReady(true)}
        className="w-full h-full object-cover home-background"
        style={{ 
          opacity: isReady ? opacity * 1.3 : 0, 
          transition: 'opacity 0.6s ease-in-out', // Smooth premium fade-in once video playback starts
          filter: 'brightness(1.25) contrast(1.05)' // Boost brightness and contrast for premium visual clarity
        }}
      >
        <source src={animPath} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
    </div>
  );
}
