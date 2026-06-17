import { PlayerData, AIProgress } from "../../types";
import { getLevelElo } from "../elo-system";
import { Capacitor } from "@capacitor/core";
import { DEFAULT_AI_PROGRESS } from "../../game/ai/aiProgressDefaults";
import { loadProtectedPlayerData, saveProtectedPlayerData } from "../protectedSave";

export const DEFAULT_PLAYER_DATA: PlayerData = {
  name: "Guest",
  rating: 100, // Start ELO at 100
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  musicOn: true,
  sfxOn: true,
  isPremium: false,
  cameraSensitivity: 1.0,
  fontSize: 1.0,
  tier: 0,
  char: 0,
  consecLoss: 0,
  hardLocked: false,
  showHints: true,
  undoEnabled: true,
  language: 'en',
  whiteWins: 0,
  whiteLosses: 0,
  blackWins: 0,
  blackLosses: 0,
  whiteTime: 0,
  blackTime: 0,
  viewMode: '3d',
  dailyUndoCount: 0,
  lastUndoDate: new Date().toDateString(),
  selectedPieceSet: 'classic',
  homeAnimation: 'homeanimation.mp4',
  boardTheme: 'classic',
  preferredSide: 'w',
  lowGraphics: false,
  showDebugOverlay: false,
  graphicsPreferenceSet: false,
  aiProgress: DEFAULT_AI_PROGRESS,
  coins: 0,
  xp: 0,
  badges: [],
  multiplayerHistory: [],
  commentaryEnabled: true,
  arenaRating: 1200,
  appliedArenaResultIds: [],
};

export function migrateAIProgress(data: any): AIProgress {
  if (data.aiProgress) {
    return data.aiProgress;
  }

  const progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
  progress.elo = data.rating || 100;
  
  const oldTier = data.tier || 0;
  const oldChar = data.char || 0;

  if (oldTier === 0) {
    if (oldChar <= 2) {
      progress.tier = 'core';
      progress.level = oldChar + 1;
      progress.unlockedTiers = ['core'];
    } else if (oldChar <= 7) {
      progress.tier = 'beginner';
      progress.level = (oldChar - 3) + 1;
      progress.unlockedTiers = ['core', 'beginner'];
    } else if (oldChar <= 12) {
      progress.tier = 'learner';
      progress.level = (oldChar - 8) + 1;
      progress.unlockedTiers = ['core', 'beginner', 'learner'];
    } else if (oldChar === 13) {
      progress.tier = 'promotion_trial';
      progress.level = 1; // Promotion Trial
      progress.unlockedTiers = ['core', 'beginner', 'learner', 'promotion_trial'];
      progress.promotionTrial.unlocked = true;
    } else {
      progress.tier = 'intermediate';
      progress.level = 1;
      progress.unlockedTiers = ['core', 'beginner', 'learner', 'promotion_trial', 'intermediate'];
      progress.promotionTrial.completed = true;
    }
  } else if (oldTier === 1) {
    if (oldChar <= 7) {
      progress.tier = 'intermediate';
      progress.level = oldChar + 1;
      progress.unlockedTiers = ['core', 'beginner', 'learner', 'promotion_trial', 'intermediate'];
      progress.promotionTrial.completed = true;
    } else {
      progress.tier = 'hard';
      progress.level = (oldChar - 8) + 1;
      progress.unlockedTiers = ['core', 'beginner', 'learner', 'promotion_trial', 'intermediate', 'hard'];
      progress.promotionTrial.completed = true;
    }
  } else {
    progress.tier = 'grandmaster';
    progress.level = 1;
    progress.unlockedTiers = ['core', 'beginner', 'learner', 'promotion_trial', 'intermediate', 'hard', 'master', 'grandmaster'];
    progress.promotionTrial.completed = true;
    progress.grandmaster.unlocked = true;
  }

  return progress;
}

export function loadPlayerData(): PlayerData {
  const isMobileDevice = Capacitor.isNativePlatform() || (
    typeof navigator !== 'undefined' && (
      /Android|iPhone|iPad/i.test(navigator.userAgent) || 
      ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 4)
    )
  );

  const data = loadProtectedPlayerData(DEFAULT_PLAYER_DATA);

  // On mobile, if the user has not manually set their graphics preference, force lowGraphics default
  if (!data.graphicsPreferenceSet && isMobileDevice) {
    data.lowGraphics = true;
  }

  return data;
}

export function savePlayerData(data: PlayerData) {
  if (data.aiProgress) {
    data.rating = data.aiProgress.elo;
  }
  saveProtectedPlayerData(data);
}

export function resetPlayerData(): PlayerData {
  const deviceId = localStorage.getItem("clash_of_crowns_device_id");
  localStorage.clear(); // Clear everything to be safe for a full reset
  if (deviceId) {
    localStorage.setItem("clash_of_crowns_device_id", deviceId);
  }
  return DEFAULT_PLAYER_DATA;
}

export interface SavedGameState {
  fen: string;
  turn: 'w' | 'b';
  capturedPieces: { w: string[], b: string[] };
  lastMove: { from: string; to: string } | null;
  history: any[];
  whiteTime: number;
  blackTime: number;
  playerColor: 'w' | 'b' | null;
  selectedCharacterId: string | null;
  localGameConfig: any | null;
  matchId?: string | null;
}

export function saveGameState(state: SavedGameState | null) {
  if (state) {
    localStorage.setItem("clash_of_crowns_saved_game", JSON.stringify(state));
  } else {
    localStorage.removeItem("clash_of_crowns_saved_game");
  }
}

export function loadGameState(): SavedGameState | null {
  const saved = localStorage.getItem("clash_of_crowns_saved_game");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migrate old selectedLevel if needed
      if (parsed.selectedLevel && !parsed.selectedCharacterId) {
         // Drop the legacy save rather than writing complex map logic for a resume state
         return null;
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse saved game", e);
    }
  }
  return null;
}

export function getRank(rating: number) {
  if (rating === 0) return "Unranked 🛡️";
  if (rating >= 2500) return "Grandmaster 👑";
  if (rating >= 2000) return "Master ♚";
  if (rating >= 1500) return "Hard Level 🔥";
  if (rating >= 1100) return "Intermediate ⚡";
  if (rating >= 1000) return "Trial Zone ⚔️";
  if (rating >= 700) return "Learner ⭐";
  if (rating >= 300) return "Beginner 🛡️";
  return "Core 🛡️";
}
