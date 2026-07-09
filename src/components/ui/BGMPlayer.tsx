import React, { useEffect, useRef } from 'react';
import { AppScreen } from '../../types';

interface BGMPlayerProps {
  musicOn: boolean;
  currentScreen: AppScreen;
}

export default function BGMPlayer({ musicOn, currentScreen }: BGMPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrc = '/homebgm2.mp3'; // Direct path allows browsers to stream audio fluidly

  useEffect(() => {
    let activeListeners = false;
    const audio = audioRef.current;
    if (!audio) return;

    const handleInteraction = () => {
      if (audio && audio.paused) {
        const isAcademy = currentScreen === 'Learn';
        const isGame = currentScreen === 'Game';
        const shouldPlay = musicOn && !isAcademy && !isGame;

        if (shouldPlay) {
          console.log("🔊 User interacted. Resuming background music...");
          audio.play()
            .then(() => {
              removeListeners();
            })
            .catch((err) => {
              console.warn("⚠️ BGM play failed after interaction:", err);
            });
        } else {
          removeListeners();
        }
      } else {
        removeListeners();
      }
    };

    const attachListeners = () => {
      if (activeListeners) return;
      activeListeners = true;
      const events = ['click', 'touchstart', 'mousedown', 'keydown'];
      events.forEach(event => {
        document.addEventListener(event, handleInteraction, { passive: true });
      });
    };

    const removeListeners = () => {
      if (!activeListeners) return;
      activeListeners = false;
      const events = ['click', 'touchstart', 'mousedown', 'keydown'];
      events.forEach(event => {
        document.removeEventListener(event, handleInteraction);
      });
    };

    const playAudio = async () => {
      audio.volume = 0.25; // Slightly lower default volume to be less intrusive

      const isAcademy = currentScreen === 'Learn';
      const isGame = currentScreen === 'Game';
      const shouldPlay = musicOn && !isAcademy && !isGame;

      if (shouldPlay) {
        if (audio.paused) {
          try {
            await audio.play();
            console.log("🎵 Background music playing.");
          } catch (e) {
            console.log("🔇 BGM auto-play blocked by browser. Awaiting interaction...");
            attachListeners();
          }
        }
      } else {
        if (!audio.paused) {
          console.log("⏸️ Pausing background music.");
          audio.pause();
        }
        removeListeners();
      }
    };

    const handleVisibilityChange = () => {
      const isAcademy = currentScreen === 'Learn';
      const isGame = currentScreen === 'Game';
      const shouldPlay = musicOn && !isAcademy && !isGame;

      if (document.hidden) {
        if (!audio.paused) {
          audio.pause();
        }
      } else {
        if (shouldPlay && audio.paused) {
          audio.play().catch(() => attachListeners());
        }
      }
    };

    playAudio();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      removeListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      if (audio && !audio.paused) {
        audio.pause();
      }
    };
  }, [musicOn, currentScreen]);

  return (
    <audio
      ref={audioRef}
      src={audioSrc}
      loop
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
