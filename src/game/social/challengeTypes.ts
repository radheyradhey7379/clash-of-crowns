import { LeaderboardMode } from '../leaderboard/leaderboardTypes';

export type ChallengeStatus = 'pending' | 'seen' | 'accepted' | 'declined' | 'expired';
export type ChallengeType = 'poke' | 'challenge';
export type ChallengeMode = 'friendly_duel';

export interface ChallengeRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  toName?: string;
  fromRank?: number;
  fromMode: LeaderboardMode;
  type: ChallengeType;
  mode: ChallengeMode;
  status: ChallengeStatus;
  message: string;
  createdAt: number;
  expiresAt: number;
  roomId?: string;
  roomStatus?: 'not_created' | 'created' | 'joined' | 'completed';
  acceptedAt?: number;
}

export interface PlayerPublicPreview {
  uid: string;
  name: string;
  compRank: number;
  arenaRank: number;
  compElo: number;
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  arenaDraws: number;
  arenaWinRate: number; // between 0 and 100
  arenaMatches: number;
  badges: string[];
  photoURL?: string;
  lastActive?: string;
}

export interface ChatNotification {
  id: string;
  type: 'challenge_request';
  fromUid: string;
  toUid: string;
  title: string;
  message: string;
  challengeRequestId: string;
  read: boolean;
  createdAt: number;
}

export interface ChatInboxMessage {
  id: string;
  challengerUid: string;
  challengerName: string;
  toUid: string;
  fromMode: LeaderboardMode;
  rank?: number;
  challengeRequestId: string;
  message: string;
  type: 'challenge_request';
  status: ChallengeStatus;
  read: boolean;
  createdAt: number;
  roomId?: string;
  actionLabel?: string;
}
