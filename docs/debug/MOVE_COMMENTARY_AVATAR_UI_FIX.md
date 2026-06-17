# Move Commentary & Avatar UI Fix

This document covers fixes for the infinite render cycle, repeated commentary lines, and responsive positioning of the commentary bubble.

## 1. Infinite Render Loop Resolution
Removed `isAIThinking` from the dependencies of the AI thinking `useEffect` hook in `GameScreen.tsx`.
Previously, setting `setIsAIThinking(true)` inside the effect caused the hook to clean up and re-run immediately because it was in its own dependency array, leading to a constant re-render cycle (and multiple taunt selections per second).
Removing the state from the dependencies resolves the loop, allowing the effect to trigger exactly once per turn.

## 2. Commentary Positioning & Layout
Redesigned `AvatarCommentaryBubble.tsx` to present a premium responsive layout:
- **Desktop**: Commentary bubble and avatar are positioned in the bottom-right corner (`md:bottom-24 md:right-6 md:left-auto md:translate-x-0`), leaving the center of the board completely clear.
- **Mobile**: Positions as a small bottom toast (`bottom-[95px] left-1/2 -translate-x-1/2`) that fits perfectly above the bottom menu bars and does not overlap chessboard squares.
- **Avatar Area**: Added a dedicated rounded avatar element containing a Bottts SVG image from DiceBear using the active opponent's name as seed:
  `https://api.dicebear.com/7.x/bottts/svg?seed=${characterName}`

## 3. Safety Cleanup
Ensured all timers (timeouts/intervals) registered by the commentary bubble or taunts are properly cleared on component unmount to prevent leaks.
