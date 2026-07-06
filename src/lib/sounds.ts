const sounds = {
  move: '/piecesound.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  capture: '/piecesound.mp3',
  check: '/piecesound.mp3',
  gameover: 'https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3',
  clapping: 'https://assets.mixkit.co/active_storage/sfx/2575/2575-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
  victory: '/victory.mp3',
  defeat: '/defeat.mp3'
};

// Cache of preloaded Blob URLs or original paths
const audioCache: Record<string, string> = {};

// Preload local assets to prevent latency when played
export const preloadSounds = async () => {
  if (typeof window === 'undefined') return;

  const keys = Object.keys(sounds) as Array<keyof typeof sounds>;
  for (const key of keys) {
    const src = sounds[key];
    if (src.startsWith('/')) {
      try {
        let response: Response | null = null;

        // Try Cache Storage first
        if (typeof caches !== 'undefined') {
          const cache = await caches.open('clash-offline-assets').catch(() => null);
          if (cache) {
            response = await cache.match(`.${src}`).catch(() => null) || 
                       await cache.match(src).catch(() => null);
          }
        }

        // Fallback: fetch from network
        if (!response) {
          response = await fetch(src);
        }

        if (response && response.ok) {
          const blob = await response.blob();
          audioCache[key] = URL.createObjectURL(blob);
          console.log(`🎵 Preloaded sound effect locally: ${key}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to preload sound ${key}:`, err);
      }
    }
  }
};

// Auto-start preloading in the browser
if (typeof window !== 'undefined') {
  preloadSounds();
}

export const playSound = (type: 'move' | 'click' | 'capture' | 'check' | 'gameover' | 'clapping' | 'success' | 'victory' | 'defeat') => {
  const src = audioCache[type] || sounds[type];
  const audio = new Audio(src);
  audio.volume = 0.5;
  audio.play().catch(e => console.warn("Sound play failed:", e));
};
