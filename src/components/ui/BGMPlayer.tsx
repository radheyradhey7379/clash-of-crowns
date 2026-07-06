import React, { useEffect, useRef, useState } from 'react';
import { AppScreen } from '../../types';

interface BGMPlayerProps {
  musicOn: boolean;
  currentScreen: AppScreen;
}

export default function BGMPlayer({ musicOn, currentScreen }: BGMPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string>('/homebgm2.mp3');

  // Load the BGM audio file locally as a Blob/Object URL to prevent network streaming lag
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    const loadLocalBGM = async () => {
      try {
        if (typeof window === 'undefined') return;

        // Try to fetch from the offline Cache Storage API first
        if (typeof caches !== 'undefined') {
          const cache = await caches.open('clash-offline-assets').catch(() => null);
          if (cache) {
            const cachedResponse = await cache.match('./homebgm2.mp3').catch(() => null) || 
                                   await cache.match('/homebgm2.mp3').catch(() => null);
            if (cachedResponse) {
              const blob = await cachedResponse.blob();
              if (isMounted) {
                objectUrl = URL.createObjectURL(blob);
                setAudioSrc(objectUrl);
                console.log("🎵 BGM loaded successfully from local Cache Storage Blob.");
                return;
              }
            }
          }
        }

        // Fallback: fetch from network and resolve to blob URL to avoid streaming lag
        const response = await fetch('/homebgm2.mp3');
        if (response.ok) {
          const blob = await response.blob();
          if (isMounted) {
            objectUrl = URL.createObjectURL(blob);
            setAudioSrc(objectUrl);
            console.log("🎵 BGM fetched and converted to local Blob URL.");
          }
        }
      } catch (err) {
        console.warn("⚠️ Failed to load BGM as local blob, using default path:", err);
      }
    };

    loadLocalBGM();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  useEffect(() => {
    let activeListeners = false;
    const audio = audioRef.current;

    // Define the interaction handler inside the effect to cleanly attach/remove
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
              console.warn("⚠️ BGM play failed even after user interaction:", err);
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
      if (!audio) return;

      audio.volume = 0.35;

      const isAcademy = currentScreen === 'Learn';
      const isGame = currentScreen === 'Game';
      const shouldPlay = musicOn && !isAcademy && !isGame;

      if (shouldPlay) {
        if (audio.paused) {
          try {
            await audio.play();
            console.log("🎵 Background music started successfully.");
          } catch (e) {
            console.log("🔇 BGM auto-play blocked by browser policy. Awaiting user interaction...");
            attachListeners();
          }
        }
      } else {
        if (!audio.paused) {
          console.log("⏸️ Pausing background music (moving to non-music screen or toggled off).");
          audio.pause();
        }
        removeListeners();
      }
    };

    // Handle visibility/focus changes to pause music when minimized or tab closed/hidden
    const handleVisibilityChange = () => {
      if (!audio) return;
      const isAcademy = currentScreen === 'Learn';
      const isGame = currentScreen === 'Game';
      const shouldPlay = musicOn && !isAcademy && !isGame;

      if (document.hidden) {
        if (!audio.paused) {
          console.log("⏸️ Tab hidden. Pausing background music.");
          audio.pause();
        }
      } else {
        if (shouldPlay && audio.paused) {
          console.log("▶️ Tab visible. Resuming background music.");
          audio.play().catch(() => attachListeners());
        }
      }
    };

    playAudio();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    // Clean up event listeners and PAUSE the audio on unmount or screen/music change
    return () => {
      removeListeners();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      if (audio && !audio.paused) {
        audio.pause();
      }
    };
  }, [musicOn, currentScreen, audioSrc]);

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
