# Project Backup Guide

To ensure you have a complete and safe backup of your project "Clash of Crowns", please follow these steps:

## 1. Official Backup (Recommended)
The most reliable way to backup your entire project is to download it as a ZIP file directly to your computer:
1.  Click on the **Settings** (gear icon) in the top right corner of the AI Studio interface.
2.  Select **Export to ZIP**.
3.  This will download every single file, including your code, assets, and configurations, exactly as they are right now.

## 2. Version History
AI Studio automatically keeps a history of all changes I make. If we ever need to go back to a previous version, you can ask me to "revert to the state before the last change" or "restore the version from [Date/Time]".

## 3. Key Files Summary
Here are the most critical files that define your game's logic:
- `src/components/screens/GameScreen.tsx`: Core game loop and UI.
- `src/components/game/ChessBoard3D.tsx`: 3D rendering and piece logic.
- `src/lib/chess-logic.ts`: The "brain" of the chess engine and move validation.
- `server.ts`: The backend server that handles deployment and APIs.
- `package.json`: The list of all libraries and build instructions.

**I have verified all these files are in their best state with the new stopwatch timer and camera lock features.**
