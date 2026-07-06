export const playSound = (type: 'move' | 'click' | 'capture' | 'check' | 'gameover' | 'clapping' | 'success' | 'victory' | 'defeat') => {
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

  const audio = new Audio(sounds[type]);
  audio.volume = 0.5;
  audio.play().catch(e => console.warn("Sound play failed:", e));
};
