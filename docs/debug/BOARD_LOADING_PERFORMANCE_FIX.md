# Board Loading & Performance Fix

This document covers optimizations to prevent blank board screens and slow 3D board loading states from blocking gameplay.

## 1. Background Preloading
Modified `src/App.tsx` to prefetch the `ChessBoard3D` module in the background 2 seconds after the app mounts:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    import('./components/game/ChessBoard3D').catch(() => {});
  }, 2000);
  return () => clearTimeout(timer);
}, []);
```
This cache-warms the dynamic import bundle so that when the user starts a game, the 3D assets are already loaded or loading in the background.

## 2. Component mount signaling
Modified `src/components/game/ChessBoard3D.tsx` to accept an `onLoad?: () => void` property and execute it inside a mount `useEffect` hook, signaling that the ThreeJS Canvas and web worker resources are initialized and painted.

## 3. Loading Timeout fallback
Modified `src/components/screens/GameScreen.tsx` to:
- Pass `onLoad={() => setIs3DLoaded(true)}` to `ChessBoard3D`.
- Track `is3DLoaded` state.
- If the player is in `3D` view mode and the board takes more than 5 seconds to load, show a non-blocking UI alert toast: `"3D board is still loading. Switch to 2D?"`.
- The user can click "Switch to 2D" to fall back to the fully interactive 2D chessboard instantly without any blocking/freezing, or click "Dismiss" to continue waiting.
