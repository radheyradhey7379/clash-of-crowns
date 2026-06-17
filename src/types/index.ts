import { AIProgress } from './aiProgression';
import { MultiplayerHistoryItem } from '../game/multiplayer/multiplayerTypes';
export * from './aiProgression';

export type AppScreen =
  | 'Splash'
  | 'Login'
  | 'Home'
  | 'LevelSelect'
  | 'Game'
  | 'Learn'
  | 'Stats'
  | 'Settings'
  | 'About'
  | 'Rank'
  | 'Leaderboard'
  | 'Profile'
  | 'Chat'
  | 'Premium'
  | 'Customise'
  | 'Tournament';

export type Language = 'en' | 'hi' | 'ur' | 'ar';

export interface PlayerData {
  uid?: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  bestStreak: number;
  musicOn: boolean;
  sfxOn: boolean;
  isPremium: boolean;
  cameraSensitivity: number;
  fontSize: number;
  tier: number;
  char: number;
  consecLoss: number;
  hardLocked: boolean;
  photoURL?: string;
  showHints: boolean;
  undoEnabled: boolean;
  language: Language;
  whiteWins: number;
  whiteLosses: number;
  blackWins: number;
  blackLosses: number;
  whiteTime: number;
  blackTime: number;
  viewMode: '2d' | '3d';
  dailyUndoCount: number;
  lastUndoDate: string;
  selectedPieceSet: 'classic' | 'royal' | 'literature' | 'sports' | 'modern';
  homeAnimation: string;
  boardTheme: 'classic' | 'wood' | 'marble' | 'neon';
  preferredSide: 'w' | 'b';
  lowGraphics?: boolean;
  showDebugOverlay?: boolean;
  graphicsPreferenceSet?: boolean;
  aiProgress: AIProgress; // Added Phase 13 progress data
  coins?: number;
  xp?: number;
  badges?: string[];
  deviceId?: string;
  securityFlags?: SecurityFlag[];
  multiplayerHistory?: MultiplayerHistoryItem[];
  commentaryEnabled?: boolean;
  arenaRating?: number;
  appliedArenaResultIds?: string[];
  
  // Phase 32B Save Integrity Metadata
  saveVersion?: number;
  lastValidatedAt?: number;
  lastRewardAt?: number;
  lastMatchId?: string;
  totalMatchesCompleted?: number;
  integrityLevel?: "legacy" | "validated" | "suspicious_repaired";
  suspiciousFlags?: string[];
  clientBuildVersion?: string;
}

export interface SecurityFlag {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
}

export const TIER_LABELS = ["Core", "Beginner", "Learner", "Promotion Trial", "Intermediate", "Hard", "Master", "Grandmaster"];

export const TIER_KEYS = ["core", "beginner", "learner", "promotion_trial", "intermediate", "hard", "master", "grandmaster"] as const;

export const TIER_COLORS = [
  "#338033", // Core
  "#5cbd5c", // Beginner
  "#2196f3", // Learner
  "#9c27b0", // Promotion Trial
  "#f44336", // Intermediate
  "#e91e63", // Hard
  "#ff9800", // Master
  "#ffd700", // Grandmaster
];
