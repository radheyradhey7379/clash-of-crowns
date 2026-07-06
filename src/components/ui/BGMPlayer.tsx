import React, { useEffect, useRef } from 'react';
import { AppScreen } from '../../types';

interface BGMPlayerProps {
  musicOn: boolean;
  currentScreen: AppScreen;
}

export default function BGMPlayer({ musicOn, currentScreen }: BGMPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let activeListeners = false;

    // Define the interaction handler inside the effect to cleanly attach/remove
    const handleInteraction = () => {
      if (audioRef.current && audioRef.current.paused) {
        console.log("🔊 User interacted. Resuming background music...");
        audioRef.current.play()
          .then(() => {
            removeListeners();
          })
          .catch((err) => {
            console.warn("⚠️ BGM play failed even after user interaction:", err);
          });
      } else {
        removeListeners();
      }
    };

    const attachListeners = () => {
      if (activeListeners) return;
      console.log("📝 Registering user interaction event listeners to unlock audio...");
      activeListeners = true;
      const events = ['click', 'touchstart', 'mousedown', 'keydown'];
      events.forEach(event => {
        document.addEventListener(event, handleInteraction, { passive: true });
      });
    };

    const removeListeners = () => {
      if (!activeListeners) return;
      console.log("🧹 Removing user interaction event listeners (audio unlocked)...");
      activeListeners = false;
      const events = ['click', 'touchstart', 'mousedown', 'keydown'];
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };

    const playAudio = async () => {
      if (!audioRef.current) return;

      // Lower default volume to be atmospheric and pleasant
      audioRef.current.volume = 0.35;

      const isAcademy = currentScreen === 'Learn';
      const isGame = currentScreen === 'Game';
      const shouldPlay = musicOn && !isAcademy && !isGame;

      if (shouldPlay) {
        if (audioRef.current.paused) {
          try {
            await audioRef.current.play();
            console.log("🎵 Background music started successfully.");
          } catch (e) {
            console.log("🔇 BGM auto-play blocked by browser policy. Awaiting user interaction...");
            attachListeners();
          }
        }
      } else {
        if (!audioRef.current.paused) {
          console.log("⏸️ Pausing background music (moving to non-music screen or toggled off).");
          audioRef.current.pause();
        }
        removeListeners();
      }
    };

    playAudio();

    // Clean up event listeners on unmount or when screen/music state changes
    return () => {
      removeListeners();
    };
  }, [musicOn, currentScreen]);

  return (
    <audio
      ref={audioRef}
      src="/homebgm2.mp3"
      loop
      preload="none"
      style={{ display: 'none' }}
    />
  );
}
