import { PlayerData, AIProgress } from "../../types";
import { getLevelElo } from "../elo-system";
import { Capacitor } from "@capacitor/core";
import { DEFAULT_AI_PROGRESS } from "../../game/ai/aiProgressDefaults";
import { loadProtectedPlayerData, saveProtectedPlayerData } from "../protectedSave";

export const DEFAULT_PLAYER_DATA: PlayerData = {
  name: "Guest",
  rating: 0, // Start ELO at 0
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
  whiteDraws: 0,
  whiteGames: 0,
  blackWins: 0,
  blackLosses: 0,
  blackDraws: 0,
  blackGames: 0,
  totalWins: 0,
  totalLosses: 0,
  totalDraws: 0,
  totalGames: 0,
  currentStreak: 0,
  undoTokens: 5,
  whiteTime: 0,
  blackTime: 0,
  viewMode: '3d',
  dailyUndoCount: 0,
  lastUndoDate: new Date().toDateString(),
  selectedPieceSet: 'classic',
  homeAnimation: 'bg1.mp4',
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
  commentaryEnabled: false,
  arenaRating: 1200,
  appliedArenaResultIds: [],
};

export function migrateAIProgress(data: any): AIProgress {
  if (data.aiProgress) {
    // If it already has aiProgress, migrate core/promotion_trial fields within it if present
    const progress = data.aiProgress;
    if (progress.tier === 'core') {
      progress.tier = 'beginner';
      progress.level = 1;
      progress.elo = Math.max(0, progress.elo);
    }
    if (progress.tier === 'promotion_trial') {
      progress.tier = 'learner';
      progress.level = 5;
    }
    if (progress.unlockedTiers) {
      progress.unlockedTiers = progress.unlockedTiers.filter((t: any) => t !== 'core' && t !== 'promotion_trial');
      if (progress.unlockedTiers.length === 0) {
        progress.unlockedTiers.push('beginner');
      } else if (!progress.unlockedTiers.includes('beginner')) {
        progress.unlockedTiers.unshift('beginner');
      }
    }
    if (progress.lockedTiers) {
      progress.lockedTiers = progress.lockedTiers.filter((t: any) => t !== 'core' && t !== 'promotion_trial');
    }
    return progress;
  }

  const progress = JSON.parse(JSON.stringify(DEFAULT_AI_PROGRESS));
  progress.elo = data.rating !== undefined ? data.rating : 0;
  
  const oldTier = data.tier || 0;
  const oldChar = data.char || 0;

  if (oldTier === 0) {
    if (oldChar <= 2) {
      progress.tier = 'beginner';
      progress.level = 1;
      progress.unlockedTiers = ['beginner'];
    } else if (oldChar <= 7) {
      progress.tier = 'beginner';
      progress.level = (oldChar - 3) + 1;
      progress.unlockedTiers = ['beginner'];
    } else if (oldChar <= 12) {
      progress.tier = 'learner';
      progress.level = (oldChar - 8) + 1;
      progress.unlockedTiers = ['beginner', 'learner'];
    } else if (oldChar === 13) {
      progress.tier = 'learner';
      progress.level = 5;
      progress.unlockedTiers = ['beginner', 'learner'];
    } else {
      progress.tier = 'intermediate';
      progress.level = 1;
      progress.unlockedTiers = ['beginner', 'learner', 'intermediate'];
    }
  } else if (oldTier === 1) {
    if (oldChar <= 7) {
      progress.tier = 'intermediate';
      progress.level = oldChar + 1;
      progress.unlockedTiers = ['beginner', 'learner', 'intermediate'];
    } else {
      progress.tier = 'hard';
      progress.level = (oldChar - 8) + 1;
      progress.unlockedTiers = ['beginner', 'learner', 'intermediate', 'hard'];
    }
  } else {
    progress.tier = 'grandmaster';
    progress.level = 1;
    progress.unlockedTiers = ['beginner', 'learner', 'intermediate', 'hard', 'master', 'grandmaster'];
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
  if (rating >= 1450) return "Grandmaster 👑";
  if (rating >= 1150) return "Master ♚";
  if (rating >= 850) return "Hard Level 🔥";
  if (rating >= 550) return "Intermediate ⚡";
  if (rating >= 300) return "Learner ⭐";
  return "Beginner 🛡️";
}
