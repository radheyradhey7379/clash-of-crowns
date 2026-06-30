import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float, Text, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { AppScreen, PlayerData, TIER_LABELS } from '../../types';
import { ChessLogic } from '../../lib/chess-logic';
import { EngineBrain } from '../../game/engine/engineBrain';
import { getBotProfile } from '../../game/engine/campaign/botProfiles';
import { getLevelElo } from '../../lib/elo-system';
import { AI_CHARACTERS } from '../../game/ai/aiCharacters';
import { matchFlowService } from '../../game/ai/matchFlowService';
import { getCurrentPlayableCharacterId, getGameResultCTA, isCharacterUnlocked } from '../../game/ai/progressionEngine';
import { getAIDifficultySettings } from '../../game/ai/aiDifficulty';
import { createMatchSession } from '../../game/security/matchSessionGuard';
import { playSound } from '../../lib/sounds';
import { ChevronLeft, RotateCcw, Home, Layout, BarChart2, Undo2, Menu, X, Box, Square, Crown, Shield, Loader2, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/translations';
import ChessBoard2D from '../game/ChessBoard2D';
const ChessBoard3D = lazy(() => import('../game/ChessBoard3D'));
const Room = lazy(() => import('../game/ChessBoard3D').then(m => ({ default: m.Room })));
const CameraGuard = lazy(() => import('../game/ChessBoard3D').then(m => ({ default: m.CameraGuard })));
import GameplayReview from '../GameplayReview';
import { saveGameState, loadGameState, SavedGameState } from '../../lib/store';
import { io, Socket } from 'socket.io-client';
import GameLoadingScreen from '../ui/GameLoadingScreen';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { submitMove, subscribeToMoves } from '../../game/multiplayer/multiplayerMoveService';
import { setPlayerOnline, setPlayerOffline, updateLastSeen, subscribeToPresence } from '../../game/multiplayer/multiplayerPresenceService';
import { submitResult, subscribeToResult } from '../../game/multiplayer/multiplayerResultService';
import { updateRoomFen, getRoom } from '../../game/multiplayer/multiplayerRoomService';
import { validateLegalMove, validateTurn, validateMoveNumber, validatePlayerInRoom, validateRoomStatus } from '../../game/multiplayer/multiplayerValidation';
import { createDrawOffer, getActiveDrawOffer, subscribeToDrawOffers, acceptDrawOffer, declineDrawOffer } from '../../game/multiplayer/multiplayerDrawService';
import { registerSubscription, cleanupRoomListeners } from '../../game/multiplayer/multiplayerCleanupService';
import { addMultiplayerHistoryItem } from '../../game/multiplayer/multiplayerHistoryService';
import { realtimeMultiplayerAdapter } from '../../game/multiplayer/realtimeMultiplayerAdapter';
import { createCupRoundRobin, recordMatchResult, simulateAiVsAiMatch } from '../../game/engine/campaign/cupRoundRobin';
import { realtimeClient } from '../../services/realtime/realtimeClient';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { getOfflinePackageMetadata } from '../../lib/offline/offlinePackage';
import { subscribeToNetworkChanges } from '../../lib/offline/networkStatus';
import {
  subscribeToSyncStatus,
  subscribeToPendingCount,
  SyncStatus
} from '../../lib/cloud/cloudSyncManager';
import { detectMoveReaction, shouldReactToMove } from '../../game/commentary/moveReactionEngine';
import { selectCommentaryLine } from '../../game/commentary/commentarySelector';
import { CommentaryReaction, CommentaryTrigger } from '../../game/commentary/commentaryTypes';
import AvatarCommentaryBubble from '../game/AvatarCommentaryBubble';

interface HistoryItem {
  fen: string;
  move: string;
  evaluation: number;
  comment?: string;
  moveNumber: number;
  side: string;
  classification: 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

interface GameScreenProps {
  onNavigate: (screen: AppScreen, level?: any, localConfig?: any, multiplayerConfig?: any) => void;
  playerData: PlayerData;
  selectedCharacterId: string | null;
  localGameConfig?: { player1: string; player2: string; player1Color: 'w' | 'b' } | null;
  multiplayerConfig?: { roomId: string; role: 'host' | 'guest'; color: 'w' | 'b' } | null;
  onUpdatePlayerData: (newData: Partial<PlayerData>) => void;
  forceOpenMenu?: number;
}

function CameraDirector({ turn, playerColor, isLocalVS, isCameraLocked }: { turn: 'w' | 'b', playerColor: 'w' | 'b' | null, isLocalVS: boolean, isCameraLocked: boolean }) {
  // CameraDirector is now a placeholder as user wants pure manual control
  // and no auto-rotation during game.
  return null;
}

function CameraResetter({ playerColor }: { playerColor: 'w' | 'b' }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 10, -12);
    camera.lookAt(0, 1.5, 0);
  }, [playerColor, camera]);
  return null;
}
const getPieceUnicode = (type: string) => {
  switch (type) {
    case 'p': return '♟';
    case 'n': return '♞';
    case 'b': return '♝';
    case 'r': return '♜';
    case 'q': return '♛';
    case 'k': return '♚';
    default: return '';
  }
};

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 2,
  b: 3,
  r: 4,
  q: 5,
  k: 6,
};

const sortCapturedPieces = (pieces: string[]) => {
  return [...pieces].sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b]);
};

const RenderCaptured2D = ({ pieces, isWhitePiece }: { pieces: string[], isWhitePiece: boolean }) => {
  const sorted = sortCapturedPieces(pieces);
  return (
    <div className="flex items-center gap-1 min-h-[24px] px-2.5 py-0.5 bg-black/45 backdrop-blur-xl border border-white/5 rounded-lg shadow-inner select-none">
      {sorted.length === 0 ? (
        <span className="text-[8px] text-white/20 font-sans tracking-wider uppercase font-semibold">No Captures</span>
      ) : (
        <div className="flex items-center -space-x-1 sm:-space-x-1.5">
          {sorted.map((type, idx) => (
            <span
              key={idx}
              className={cn(
                "text-sm sm:text-base font-normal transition-all leading-none",
                isWhitePiece 
                  ? "text-[#ffffff] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" 
                  : "text-[#d9ad33] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              )}
            >
              {getPieceUnicode(type)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

function PerformanceOverlay({ 
  show, 
  rtt,
  boardLoadTime,
  aiCalcTime,
  lowGraphics,
  aiEngineType,
  aiDepth,
  maxThinkTimeMs,
  lastMoveLatency
}: { 
  show: boolean; 
  rtt: number | null;
  boardLoadTime: number | null;
  aiCalcTime: number | null;
  lowGraphics: boolean;
  aiEngineType?: string;
  aiDepth?: number | null;
  maxThinkTimeMs?: number | null;
  lastMoveLatency?: number | null;
}) {
  const [fps, setFps] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unauthenticated');
  const [pendingCount, setPendingCount] = useState(0);
  const { width, height } = useDeviceLayout();
  
  useEffect(() => {
    if (!show) return;
    
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;
    
    const loop = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };
    
    animId = requestAnimationFrame(loop);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to cloud sync states
    const unsubStatus = subscribeToSyncStatus(setSyncStatus);
    const unsubCount = subscribeToPendingCount(setPendingCount);
    
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubStatus();
      unsubCount();
    };
  }, [show]);

  if (!show) return null;

  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const platformInfo = isAndroid ? "Android WebView" : "Browser / Web";

  return (
    <div 
      className="fixed top-24 z-[100] bg-black/85 border border-[#d9ad33]/30 backdrop-blur-md p-4 rounded-xl shadow-2xl flex flex-col gap-1.5 font-mono text-[9px] min-w-[200px] pointer-events-none text-white/90"
      style={{ left: 'calc(1rem + env(safe-area-inset-left))' }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 pb-1 mb-1">
        <div className="w-1.5 h-1.5 bg-[#d9ad33] rounded-full animate-ping" />
        <span className="font-bold text-[#d9ad33] uppercase tracking-wider">Debug Stats</span>
      </div>
      <div>FPS: <span className={fps >= 45 ? "text-green-400 font-bold" : fps >= 30 ? "text-yellow-400 font-bold" : "text-red-400 font-bold"}>{fps}</span></div>
      <div>RTT: <span className="font-bold">{rtt !== null ? `${rtt}ms` : 'N/A'}</span></div>
      <div>Board Load: <span className="text-[#d9ad33] font-bold">{boardLoadTime !== null ? `${boardLoadTime}ms` : 'Loading...'}</span></div>
      <div>AI Engine: <span className="text-blue-400 font-bold">{aiEngineType ? aiEngineType.toUpperCase() : 'N/A'}</span></div>
      <div>AI Depth: <span className="text-indigo-400 font-bold">{aiDepth !== null ? aiDepth : 'N/A'}</span></div>
      <div>Max Think Time: <span className="text-pink-400 font-bold">{maxThinkTimeMs !== null ? `${maxThinkTimeMs}ms` : 'N/A'}</span></div>
      <div>AI Move Time: <span className="text-[#a855f7] font-bold">{aiCalcTime !== null ? `${aiCalcTime}ms` : 'N/A'}</span></div>
      <div>Last Move Latency: <span className="text-[#a855f7] font-bold">{lastMoveLatency !== null ? `${lastMoveLatency}ms` : 'N/A'}</span></div>
      <div>Graphics Mode: <span className={lowGraphics ? "text-orange-400 font-bold" : "text-cyan-400 font-bold"}>{lowGraphics ? "LOW GRAPHICS" : "HIGH QUALITY"}</span></div>
      <div>Viewport: <span className="text-white/60">{width} x {height} px</span></div>
      <div>Connection: <span className={isOnline ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{isOnline ? "ONLINE" : "OFFLINE"}</span></div>
      <div>Offline Package: <span className="font-bold text-[#d9ad33]">{getOfflinePackageMetadata().status.toUpperCase()}</span></div>
      <div>Cloud Sync: <span className="font-bold uppercase text-blue-400">{syncStatus}</span></div>
      <div>Pending Sync Events: <span className="font-bold text-yellow-400">{pendingCount}</span></div>
      <div>Platform: <span className="text-white/60">{platformInfo}</span></div>
      <div>UA: <span className="text-white/40 text-[7px] truncate max-w-[160px] block">{userAgent}</span></div>
    </div>
  );
}

export default function GameScreen({ onNavigate, playerData, selectedCharacterId, localGameConfig, multiplayerConfig, onUpdatePlayerData, forceOpenMenu }: GameScreenProps) {
  const t = useTranslation(playerData.language || 'en');
  const user = auth.currentUser;
  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';
  const socketRef = useRef<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [chess] = useState(() => new ChessLogic());
  const [board, setBoard] = useState(chess.getBoard());
  const [turn, setTurn] = useState(chess.getTurn());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<any[]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [status, setStatus] = useState(t.yourMove);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>(() => {
    if (multiplayerConfig) return multiplayerConfig.color;
    if (localGameConfig) return localGameConfig.player1Color;
    
    // AI match - determine color
    const validation = matchFlowService.validateCharacter(selectedCharacterId, playerData.aiProgress);
    const charId = selectedCharacterId || validation.fallbackCharacterId;
    if (charId) {
      const char = AI_CHARACTERS.find(c => c.id === charId);
      if (char && char.tier === 'master') {
        const matchIdx = playerData.aiProgress?.masterCup?.currentMatch || 1;
        return matchIdx === 2 ? 'b' : 'w';
      }
      return playerData.preferredSide || 'w';
    }
    return 'w';
  });
  
  // Loading & Performance states
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Preparing battlefield...');
  const [isGameLoading, setIsGameLoading] = useState(true);
  const boardLoadStartTime = useRef(Date.now());
  const [boardLoadTime, setBoardLoadTime] = useState<number | null>(null);
  const [aiCalcTime, setAiCalcTime] = useState<number | null>(null);
  const [isSimulatingTournament, setIsSimulatingTournament] = useState(false);

  const activeCharacterId = React.useMemo(() => {
    if (localGameConfig || multiplayerConfig) return null; // Local VS or Multiplayer match, no AI character
    
    // AI match
    const validation = matchFlowService.validateCharacter(selectedCharacterId, playerData.aiProgress);
    if (validation.valid && selectedCharacterId) {
      return selectedCharacterId;
    } else {
      console.warn(`Fallback triggered: selected=${selectedCharacterId}, playing=${validation.fallbackCharacterId}`);
      return validation.fallbackCharacterId;
    }
  }, [selectedCharacterId, playerData.aiProgress, localGameConfig, multiplayerConfig]);

  const isMultiplayer = !!multiplayerConfig;
  const isLocalVS = activeCharacterId === null && !isMultiplayer;
  const aiCharacter = activeCharacterId ? AI_CHARACTERS.find(c => c.id === activeCharacterId) : null;

  const nextCharacter = React.useMemo(() => {
    if (gameOver && gameOver.includes(t.victory) && !isLocalVS && playerData.aiProgress) {
      const nextCharId = getCurrentPlayableCharacterId(playerData.aiProgress);
      return AI_CHARACTERS.find(c => c.id === nextCharId);
    }
    return null;
  }, [gameOver, isLocalVS, playerData.aiProgress, t.victory]);

  useEffect(() => {
    if (!isLocalVS && aiCharacter && aiCharacter.tier === 'master' && playerData.aiProgress) {
      const cup = playerData.aiProgress.masterCup;
      const rrJson = localStorage.getItem('clash_cup_round_robin_state');
      let initNew = false;
      if (!rrJson) {
        initNew = true;
      } else {
        try {
          const rr = JSON.parse(rrJson);
          if (rr.cupId !== cup.currentCup || cup.currentMatch === 1) {
            initNew = true;
          }
        } catch (e) {
          initNew = true;
        }
      }

      if (initNew) {
        const cupAiBots = AI_CHARACTERS.filter(c => c.tier === 'master' && c.cup === cup.currentCup);
        if (cupAiBots.length === 3) {
          const newRR = createCupRoundRobin(
            cup.currentCup,
            playerData.uid,
            playerData.name,
            cupAiBots[0],
            cupAiBots[1],
            cupAiBots[2]
          );
          localStorage.setItem('clash_cup_round_robin_state', JSON.stringify(newRR));
          console.log("Initialized new Cup Round Robin state:", newRR);
        }
      }
    }
  }, [activeCharacterId, aiCharacter, playerData.aiProgress?.masterCup]);

  const handleMatchCompletion = async (
    result: 'win' | 'loss' | 'draw',
    reason: 'checkmate' | 'resign' | 'timeout' | 'draw'
  ) => {
    if (isLocalVS || !activeCharacterId || !playerData.aiProgress) return;
    
    // Prevent duplicate processing
    if ((window as any)._matchProcessedId === matchIdRef.current) return;
    (window as any)._matchProcessedId = matchIdRef.current;

    let cupCleared = false;

    if (aiCharacter && aiCharacter.tier === 'master') {
      const cup = playerData.aiProgress.masterCup;
      const rrJson = localStorage.getItem('clash_cup_round_robin_state');
      if (rrJson) {
        try {
          let rr = JSON.parse(rrJson);
          const matchIdx = cup.currentMatch - 1; // 0, 1, or 2

          // Record player's match result
          let matchOutcome: 'white_win' | 'black_win' | 'draw' = 'draw';
          if (result === 'win') {
            matchOutcome = rr.matches[matchIdx].whiteId === playerData.uid ? 'white_win' : 'black_win';
          } else if (result === 'loss') {
            matchOutcome = rr.matches[matchIdx].whiteId === playerData.uid ? 'black_win' : 'white_win';
          }
          
          rr = recordMatchResult(rr, matchIdx, matchOutcome);
          
          if (matchIdx === 2) {
            // Player completed their 3rd match. Simulate remaining AI vs AI matches!
            setIsSimulatingTournament(true);
            const cupAiBots = AI_CHARACTERS.filter(c => c.tier === 'master' && c.cup === rr.cupId);
            if (cupAiBots.length === 3) {
              const res3 = await simulateAiVsAiMatch(cupAiBots[0], cupAiBots[1]);
              rr = recordMatchResult(rr, 3, res3);
              const res4 = await simulateAiVsAiMatch(cupAiBots[0], cupAiBots[2]);
              rr = recordMatchResult(rr, 4, res4);
              const res5 = await simulateAiVsAiMatch(cupAiBots[1], cupAiBots[2]);
              rr = recordMatchResult(rr, 5, res5);
            }
            setIsSimulatingTournament(false);
          }
          
          localStorage.setItem('clash_cup_round_robin_state', JSON.stringify(rr));
          if (rr.status === 'completed' && rr.winnerId === playerData.uid) {
            cupCleared = true;
          }
        } catch (e) {
          console.error("Error processing Cup Round Robin match result:", e);
        }
      }
    }

    const summary = matchFlowService.processMatchResult({
      matchId: matchIdRef.current,
      characterId: activeCharacterId,
      result,
      reason,
      eloBefore: playerData.aiProgress.elo,
      playerColor,
      cupCleared
    } as any, playerData);

    setEloChange(summary.eloChange);
    setMatchRewards(summary.rewards);
    onUpdatePlayerData(summary.updatedPlayerData);
  };

  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 6;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setLoadingProgress(progress);
      
      if (progress < 20) {
        setLoadingMessage('Preparing match...');
      } else if (progress < 45) {
        setLoadingMessage('Loading board theme...');
      } else if (progress < 70) {
        setLoadingMessage('Assembling pieces...');
      } else {
        setLoadingMessage('Positioning cameras...');
      }
    }, 80);

    return () => clearInterval(interval);
  }, []);

  const [checkInfo, setCheckInfo] = useState<{ king: string; checker: string } | null>(null);
  const [matchRewards, setMatchRewards] = useState<any>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [is3DLoaded, setIs3DLoaded] = useState(false);
  const [show3DTimeoutPrompt, setShow3DTimeoutPrompt] = useState(false);
  const [latencyText, setLatencyText] = useState<string>('Ping...');
  const [showNetworkWarning, setShowNetworkWarning] = useState(true);
  const [freeUndosUsed, setFreeUndosUsed] = useState(0);
  const [showUndoPackModal, setShowUndoPackModal] = useState(false);
  const [latencyColorClass, setLatencyColorClass] = useState<string>('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
  const lastPongReceivedTime = useRef<number>(Date.now());
  const [lastMoveLatency, setLastMoveLatency] = useState<number | null>(null);
  const [aiTaunt, setAiTaunt] = useState<string | null>(null);
  const [activeCommentary, setActiveCommentary] = useState<CommentaryReaction | null>(null);
  const lastReactionTimeRef = useRef<number>(0);
  const lastPriorityRef = useRef<number>(0);
  const lastLineTextRef = useRef<string | undefined>(undefined);
  const movesSinceLastTaunt = useRef(4);
  const tauntTimeoutRef = useRef<any>(null);
  const matchIdRef = useRef<string>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ w: string[], b: string[] }>({ w: [], b: [] });
  const [showReview, setShowReview] = useState(false);
  const [eloChange, setEloChange] = useState<number | null>(null);
  const [showDeclareConfirm, setShowDeclareConfirm] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  // Dismiss loading screen when progress is 100% and 3D board is ready (if 3D mode)
  useEffect(() => {
    if (loadingProgress >= 100) {
      const is3DMode = playerData.viewMode === '3d';
      if (!is3DMode || is3DLoaded) {
        const timer = setTimeout(() => {
          setIsGameLoading(false);
          const duration = Date.now() - boardLoadStartTime.current;
          setBoardLoadTime(duration);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [loadingProgress, is3DLoaded, playerData.viewMode]);

  // Hide the network warning banner after 2 seconds to avoid match distraction
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowNetworkWarning(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [showPromotionPopup, setShowPromotionPopup] = useState(false);
  const [isCameraLocked, setIsCameraLocked] = useState(false);
  const [roomData, setRoomData] = useState<any | null>(null);
  const [opponentOnline, setOpponentOnline] = useState<boolean>(true);
  const [reconnectTimeLeft, setReconnectTimeLeft] = useState<number | null>(null);
  const [drawOfferSent, setDrawOfferSent] = useState<boolean>(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState<boolean>(false);
  const lastSelectTime = useRef(0);
  const lastClickTimeRef = useRef(0);
  const undoStackRef = useRef<any[]>([]);
  const initialCharId = selectedCharacterId || getCurrentPlayableCharacterId(playerData.aiProgress);
  const gameStartTime = useRef<number | null>((localGameConfig || initialCharId) ? Date.now() : null);
  const gameId = useRef<string>(!localGameConfig ? `ai_${initialCharId}_${playerData.uid}` : `local_${Date.now()}_${playerData.uid}`);

  const isGameInteractionBlocked =
    !!gameOver ||
    isMenuOpen ||
    showUndoPackModal ||
    showDeclareConfirm ||
    showResignConfirm ||
    showPromotionPopup ||
    showResumePrompt ||
    showReview ||
    (isMultiplayer && (drawOfferReceived || drawOfferSent || reconnectTimeLeft !== null));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showUndoPackModal) {
        playSound('click');
        setShowUndoPackModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUndoPackModal]);

  useEffect(() => {
    if (isMultiplayer) return;
    if (!socketRef.current) {
      socketRef.current = io();
    }
    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log("Socket connected:", socket.id);
      setIsSocketConnected(true);
      socket.emit('joinGame', gameId.current);
    });

    if (socket.connected) {
      setIsSocketConnected(true);
      socket.emit('joinGame', gameId.current);
    }

    socket.on('moveValidated', (data) => {
      const { fen, move, turn, isGameOver } = data;
      
      // Only update if it's not our own optimistic move (or if it's an AI move)
      if (chess.getFen() !== fen) {
        const moveResult = chess.makeMove(move);
        if (!moveResult) {
          chess.load(fen);
        } else if (moveResult.captured) {
          setCapturedPieces(prev => {
            const next = { w: [...prev.w], b: [...prev.b] };
            if (moveResult.color === 'w') {
              next.b.push(moveResult.captured);
            } else {
              next.w.push(moveResult.captured);
            }
            return next;
          });
        }
        setBoard(chess.getBoard());
        setTurn(turn);
        setLastMove({ from: move.from, to: move.to });
        updateCheckInfo();
        recordMove(moveResult || move);
        playSound('move');
      }

      if (isGameOver) {
        checkGameOver();
      }
    });

    // Latency Monitoring
    const latencyInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping_client', { t: Date.now() });
      }
    }, 5000);

    socket.on('pong_server', (data) => {
      const rtt = Date.now() - data.t;
      setLatency(rtt);
      if (rtt > 200) {
        console.warn(`High latency detected: ${rtt}ms`);
      }
    });

    socket.on('gameEnded', (data) => {
      const { winner, reason, fen } = data;
      if (fen) chess.load(fen);
      setGameOver(`${winner.toUpperCase()} ${t.victory} - ${reason.toUpperCase()}`);
      playSound('gameover');
      if (winner.toLowerCase() === (playerColor === 'w' ? 'white' : 'black')) {
        playSound('clapping');
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ['#d9ad33', '#ffffff', '#a855f7'] });
      }

      if (!isLocalVS && activeCharacterId && playerData.aiProgress) {
        const playerWon = winner.toLowerCase() === (playerColor === 'w' ? 'white' : 'black');
        handleMatchCompletion(
          playerWon ? 'win' : 'loss',
          reason === 'resignation' ? 'resign' : 'checkmate'
        );
      }
    });

    socket.on('invalidMove', (data) => {
      console.error("Invalid move received from server:", data);
      // Revert local state if necessary
      setBoard(chess.getBoard());
    });

    return () => {
      socket.off('moveValidated');
      socket.off('invalidMove');
      socket.off('pong_server');
      clearInterval(latencyInterval);

    };
  }, []);

  const saveSession = () => {
    if (isMultiplayer) return;
    if (gameOver) {
      localStorage.removeItem('chess_game_session');
      return;
    }
    const session = {
      fen: chess.getFen(),
      turn,
      capturedPieces,
      lastMove,
      whiteTime,
      blackTime,
      playerColor,
      selectedCharacterId,
      localGameConfig,
      history,
      gameStartTime: gameStartTime.current
    };
    localStorage.setItem('chess_game_session', JSON.stringify(session));
  };

  const loadSession = () => {
    if (isMultiplayer) return;
    const savedSession = localStorage.getItem('chess_game_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      chess.load(session.fen);
      setBoard(chess.getBoard());
      setTurn(session.turn);
      setCapturedPieces(session.capturedPieces);
      setLastMove(session.lastMove);
      setWhiteTime(session.whiteTime);
      setBlackTime(session.blackTime);
      setPlayerColor(session.playerColor);
      setHistory(session.history);
      gameStartTime.current = session.gameStartTime;
      updateCheckInfo();
    }
    setShowResumePrompt(false);
  };

  const clearSession = () => {
    if (isMultiplayer) return;
    localStorage.removeItem('chess_game_session');
    setShowResumePrompt(false);
  };

  // Save session on state changes
  useEffect(() => {
    if (isMultiplayer) return;
    if (playerColor || localGameConfig) {
      saveSession();
    }
  }, [turn, capturedPieces, lastMove, whiteTime, blackTime, gameOver]);

  useEffect(() => {
    if (localGameConfig && !gameStartTime.current) {
      gameStartTime.current = Date.now();
    }
  }, [localGameConfig]);

  useEffect(() => {
    let interval: any;
    if (
      gameStarted && 
      !gameOver && 
      (playerColor || localGameConfig) && 
      !showUndoPackModal && 
      !isMenuOpen && 
      !showDeclareConfirm && 
      !showResignConfirm && 
      !showPromotionPopup && 
      !showResumePrompt
    ) {
      interval = setInterval(() => {
        if (turn === 'w') {
          setWhiteTime(prev => prev + 1);
        } else {
          setBlackTime(prev => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [
    turn, 
    gameOver, 
    playerColor, 
    localGameConfig, 
    gameStarted, 
    showUndoPackModal, 
    isMenuOpen, 
    showDeclareConfirm, 
    showResignConfirm,
    showPromotionPopup,
    showResumePrompt
  ]);

  useEffect(() => {
    if (playerData.viewMode !== '3d' || is3DLoaded) {
      setShow3DTimeoutPrompt(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!is3DLoaded && playerData.viewMode === '3d') {
        onUpdatePlayerData({ viewMode: '2d' });
        setShow3DTimeoutPrompt(false);
        console.warn("Automatically fell back to 2D board due to 5-second 3D loading timeout.");
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [playerData.viewMode, is3DLoaded]);


  
  const whitePlayerName = multiplayerConfig
    ? (roomData?.hostName || 'Host')
    : localGameConfig 
      ? (localGameConfig.player1Color === 'w' ? localGameConfig.player1 : localGameConfig.player2)
      : (playerColor === 'w' ? playerData.name : (aiCharacter?.name || 'Opponent'));

  const blackPlayerName = multiplayerConfig
    ? (roomData?.guestName || 'Guest')
    : localGameConfig
      ? (localGameConfig.player1Color === 'b' ? localGameConfig.player1 : localGameConfig.player2)
      : (playerColor === 'b' ? playerData.name : (aiCharacter?.name || 'Opponent'));

  const opponentName = isMultiplayer
    ? (multiplayerConfig?.role === 'host' ? (roomData?.guestName || 'Guest') : (roomData?.hostName || 'Host'))
    : isLocalVS 
      ? (localGameConfig ? (localGameConfig.player1Color === 'w' ? roomData?.guestName || localGameConfig.player2 : localGameConfig.player1) : t.friend)
      : (aiCharacter?.name || 'Opponent');

  useEffect(() => {
    setStatus(turn === 'w' ? t.yourMove : t.opponentMove);
  }, [turn, t]);

  useEffect(() => {
    if (forceOpenMenu && forceOpenMenu > 0) {
      setIsMenuOpen(true);
    }
  }, [forceOpenMenu]);

  // Load saved game on mount
  useEffect(() => {
    if (isMultiplayer) return;
    const saved = loadGameState();
    if (saved && !gameOver) {
      // Only show resume prompt if it's the same level
      const isSameLevel = saved.selectedCharacterId === activeCharacterId;
      const isSameLocal = (!saved.selectedCharacterId && !activeCharacterId);
      
      if (isSameLevel || isSameLocal) {
        setShowResumePrompt(true);
        return;
      }
    }

    if (!isLocalVS && activeCharacterId) {
      matchIdRef.current = createMatchSession(activeCharacterId);
    }
  }, [activeCharacterId, isMultiplayer]);

  const handleContinueGame = () => {
    const saved = loadGameState();
    if (saved) {
      chess.reset(); // Clear current
      const newLogic = new ChessLogic(saved.fen);
      // We can't easily replace the 'chess' instance if it's a state, 
      // but we can update the logic inside it if we expose a load method,
      // or just use the FEN to reset the current instance.
      (chess as any).load(saved.fen); 
      setBoard(newLogic.getBoard());
      setTurn(saved.turn);
      setCapturedPieces(saved.capturedPieces);
      setLastMove(saved.lastMove);
      setHistory(saved.history);
      setWhiteTime(saved.whiteTime);
      setBlackTime(saved.blackTime);
      setPlayerColor(saved.playerColor);
      if (saved.matchId) {
        matchIdRef.current = saved.matchId;
      } else if (!isLocalVS && activeCharacterId) {
        matchIdRef.current = createMatchSession(activeCharacterId);
      }
      if (saved.history && saved.history.length > 0) {
        setGameStarted(true);
      }
      // Note: selectedCharacterId and localGameConfig are handled by App.tsx navigation
      // but we might need to sync them if they differ.
    }
    setShowResumePrompt(false);
  };

  const handleStartNewGame = () => {
    saveGameState(null);
    setShowResumePrompt(false);
    resetGame();
  };

  // Save game state on every move
  useEffect(() => {
    if (isMultiplayer) return;
    if (gameOver) {
      saveGameState(null);
      return;
    }

    if (history.length > 0) {
      const state: SavedGameState = {
        fen: chess.getFen(),
        turn,
        capturedPieces,
        lastMove,
        history,
        whiteTime,
        blackTime,
        playerColor,
        selectedCharacterId,
        localGameConfig,
        matchId: matchIdRef.current
      };
      saveGameState(state);
    }
  }, [turn, gameOver, history, whiteTime, blackTime, capturedPieces, lastMove, playerColor, selectedCharacterId, localGameConfig, isMultiplayer]);

  const recordMove = (move: any) => {
    setGameStarted(true);
    try {
      const fen = chess.getFen();
      const evaluation = (chess as any).evaluateBoard();
      
      setHistory(prev => {
        // Avoid duplicate moves in history
        if (prev.length > 0 && prev[prev.length - 1].fen === fen) {
          return prev;
        }

        const moveNumber = Math.floor(prev.length / 2) + 1;
        const side = chess.getTurn() === 'b' ? 'White' : 'Black'; // The player who just moved
        const lastEval = prev.length > 0 ? prev[prev.length - 1].evaluation : 0;
        const diff = side === 'White' ? evaluation - lastEval : lastEval - evaluation;

        let comment = `On move ${moveNumber}, ${side} played ${move.san || move.from + '-' + move.to}. A solid developing move.`;
        let classification: 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' = 'good';

        if (diff < -30) {
          comment = `Move ${moveNumber}: ${move.san || move.from + '-' + move.to} was a massive blunder!`;
          classification = 'blunder';
        } else if (diff < -15) {
          comment = `Move ${moveNumber}: ${move.san || move.from + '-' + move.to} was a significant mistake.`;
          classification = 'mistake';
        } else if (diff < -5) {
          comment = `Move ${moveNumber}: ${move.san || move.from + '-' + move.to} was a slight inaccuracy.`;
          classification = 'inaccuracy';
        } else if (diff > 20) {
          comment = `Move ${moveNumber}: ${move.san || move.from + '-' + move.to} is brilliant!`;
          classification = 'brilliant';
        } else if (diff > 10) {
          comment = `Move ${moveNumber}: ${move.san || move.from + '-' + move.to} is a great move!`;
          classification = 'best';
        }

        return [...prev, {
          fen,
          move: move.san || `${move.from}-${move.to}`,
          evaluation,
          comment,
          moveNumber,
          side,
          classification
        }];
      });

      // Commentary Integration
      const isCommentaryEnabled = playerData.commentaryEnabled !== false;
      if (isCommentaryEnabled) {
        let totalPieces = 0;
        const boardObj = chess.getBoard();
        for (const r of boardObj) {
          for (const c of r) {
            if (c) totalPieces++;
          }
        }

        const lastEval = history.length > 0 ? history[history.length - 1].evaluation : 0;
        const moveNumber = Math.floor(history.length / 2) + 1;

        const commContext = {
          roomMode: (isMultiplayer ? 'friend' : (activeCharacterId ? 'comp' : 'offline')) as any,
          playerColor: playerColor || 'w',
          currentTurn: chess.getTurn(),
          moveNumber,
          san: move.san,
          from: move.from,
          to: move.to,
          piece: move.piece,
          capturedPiece: move.captured,
          isCapture: !!move.captured || (move.flags && (move.flags.includes('c') || move.flags.includes('e'))),
          isCheck: chess.isCheck(),
          isCheckmate: chess.isCheckmate(),
          isCastle: move.flags && (move.flags.includes('k') || move.flags.includes('q')),
          isPromotion: !!move.promotion || (move.flags && move.flags.includes('p')),
          isEndgame: totalPieces <= 12,
          characterId: activeCharacterId || undefined,
          tierId: aiCharacter?.tier,
          lastEval,
          currEval: evaluation,
          totalPieces
        };

        const now = Date.now();
        if (shouldReactToMove(commContext, lastReactionTimeRef.current, lastPriorityRef.current, now)) {
          const triggers = detectMoveReaction(commContext);
          const reaction = selectCommentaryLine(commContext, triggers, lastLineTextRef.current);
          if (reaction) {
            setActiveCommentary(reaction);
            lastReactionTimeRef.current = now;
            lastPriorityRef.current = reaction.priority;
            lastLineTextRef.current = reaction.text;
          }
        }
      }
    } catch (err) {
      console.error("Error recording move:", err);
    }
  };

  const handleSquareClick = (square: string) => {
    if (isGameInteractionBlocked) return;
    if (isAIThinking) return;
    if (!isLocalVS && playerColor && turn !== playerColor) return;

    // Rapid taps protection
    const clickNow = Date.now();
    if (clickNow - lastClickTimeRef.current < 200) {
      console.warn("Ignoring rapid click/tap to prevent duplicate inputs");
      return;
    }
    lastClickTimeRef.current = clickNow;

    const now = Date.now();
    if (selectedSquare === square) {
      // Only deselect if we didn't just select it in handlePointerDown (within 300ms)
      if (now - lastSelectTime.current > 300) {
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    const piece = chess.getBoard()[8 - parseInt(square[1])][square.charCodeAt(0) - 97];
    
    if (piece && piece.color === turn) {
      playSound('click');
      setSelectedSquare(square);
      setValidMoves(chess.getMoves(square));
      lastSelectTime.current = now;
    } else if (selectedSquare) {
      // Check for pawn promotion
      const fromPiece = chess.getBoard()[8 - parseInt(selectedSquare[1])][selectedSquare.charCodeAt(0) - 97];
      const isPawn = fromPiece?.type === 'p';
      const isPromotionRank = (turn === 'w' && square[1] === '8') || (turn === 'b' && square[1] === '1');
      const isValidMove = chess.getMoves(selectedSquare).some(m => m.to === square);

      // Validate multiplayer preconditions before making or prompting the move
      if (isMultiplayer && multiplayerConfig) {
        if (!roomData) {
          console.error("No room data available.");
          return;
        }
        const currentUser = auth.currentUser;
        if (!currentUser) {
          console.error("User not authenticated.");
          return;
        }

        // 1. Validate player is in room
        if (!validatePlayerInRoom(roomData, currentUser.uid)) {
          console.error("Player is not in this room.");
          return;
        }

        // 2. Validate room is active
        if (!validateRoomStatus(roomData, 'active')) {
          console.error("Room is not active.");
          return;
        }

        // 3. Validate it is player's turn
        if (!validateTurn(roomData, currentUser.uid, playerColor)) {
          console.error("It is not player's turn.");
          return;
        }

        // 4. Validate moveNumber === room.moveCount + 1
        const nextMoveNumber = history.length + 1;
        if (!validateMoveNumber(roomData, nextMoveNumber)) {
          console.error("Invalid move number sequence.");
          return;
        }

        // 5. Validate legal move locally
        if (!validateLegalMove(chess.getFen(), { from: selectedSquare, to: square, promotion: 'q' })) {
          console.error("Move is illegal locally.");
          return;
        }
      }

      if (isValidMove) {
        undoStackRef.current.push({
          fen: chess.getFen(),
          history: [...history],
          capturedPieces: {
            w: [...capturedPieces.w],
            b: [...capturedPieces.b]
          },
          turn: chess.getTurn(),
          whiteTime,
          blackTime,
          lastMove
        });
      }

      if (isPawn && isPromotionRank && isValidMove) {
        setPendingPromotion({ from: selectedSquare, to: square });
        setShowPromotionPopup(true);
        return;
      }

      // Optimistic update
      const moveResult = chess.makeMove({ from: selectedSquare, to: square, promotion: 'q' });
      if (moveResult) {
        if (moveResult.captured) {
          setCapturedPieces(prev => {
            const next = { w: [...prev.w], b: [...prev.b] };
            if (moveResult.color === 'w') {
              next.b.push(moveResult.captured);
            } else {
              next.w.push(moveResult.captured);
            }
            return next;
          });
        }
        setBoard(chess.getBoard());
        setTurn(chess.getTurn());
        setLastMove({ from: selectedSquare, to: square });
        updateCheckInfo();
        recordMove(moveResult);
        playSound('move');
        
        if (isMultiplayer && multiplayerConfig) {
          const nextMoveNumber = history.length + 1;
          const movePayload = {
            roomId: multiplayerConfig.roomId,
            moveNumber: nextMoveNumber,
            from: selectedSquare,
            to: square,
            promotion: 'q',
            color: playerColor,
            playerUid: auth.currentUser?.uid || '',
            fenAfter: chess.getFen(),
            san: moveResult.san || ''
          };
          realtimeMultiplayerAdapter.submitMove(movePayload).catch((err) => {
            console.error("Failed to submit move:", err);
          });
        }

        // Emit move to server only for multiplayer (if implemented)
        // For now, AI and Local VS are fully local
        if (socketRef.current && !isLocalVS && !selectedCharacterId && !isMultiplayer) {
          socketRef.current.emit('move', {
            gameId: gameId.current,
            move: { from: selectedSquare, to: square, promotion: 'q' },
            userId: playerData.uid
          });
        }
        
        if (!isLocalVS && selectedCharacterId) {
          // Trigger checkGameOver locally for AI games
          checkGameOver();
        }
      } else {
        // Illegal move click - play click sound and trigger mobile vibration
        playSound('click');
        if (navigator.vibrate) {
          navigator.vibrate(80);
        }
      }
      
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handlePromotion = (pieceType: string) => {
    if (!pendingPromotion) return;

    if (isMultiplayer && multiplayerConfig) {
      if (!roomData) {
        console.error("No room data available.");
        return;
      }
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error("User not authenticated.");
        return;
      }

      // 1. Validate player is in room
      if (!validatePlayerInRoom(roomData, currentUser.uid)) {
        console.error("Player is not in this room.");
        return;
      }

      // 2. Validate room is active
      if (!validateRoomStatus(roomData, 'active')) {
        console.error("Room is not active.");
        return;
      }

      // 3. Validate it is player's turn
      if (!validateTurn(roomData, currentUser.uid, playerColor)) {
        console.error("It is not player's turn.");
        return;
      }

      // 4. Validate moveNumber === room.moveCount + 1
      const nextMoveNumber = history.length + 1;
      if (!validateMoveNumber(roomData, nextMoveNumber)) {
        console.error("Invalid move number sequence.");
        return;
      }

      // 5. Validate legal move locally
      if (!validateLegalMove(chess.getFen(), { from: pendingPromotion.from, to: pendingPromotion.to, promotion: pieceType })) {
        console.error("Move is illegal locally.");
        return;
      }
    }
    
    // Optimistic update
    const moveResult = chess.makeMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: pieceType });
    if (moveResult) {
      if (moveResult.captured) {
        setCapturedPieces(prev => {
          const next = { w: [...prev.w], b: [...prev.b] };
          if (moveResult.color === 'w') {
            next.b.push(moveResult.captured);
          } else {
            next.w.push(moveResult.captured);
          }
          return next;
        });
      }
      setBoard(chess.getBoard());
      setTurn(chess.getTurn());
      setLastMove({ from: pendingPromotion.from, to: pendingPromotion.to });
      updateCheckInfo();
      recordMove(moveResult);
      playSound('move');

      if (isMultiplayer && multiplayerConfig) {
        const nextMoveNumber = history.length + 1;
        const movePayload = {
          roomId: multiplayerConfig.roomId,
          moveNumber: nextMoveNumber,
          from: pendingPromotion.from,
          to: pendingPromotion.to,
          promotion: pieceType,
          color: playerColor,
          playerUid: auth.currentUser?.uid || '',
          fenAfter: chess.getFen(),
          san: moveResult.san || ''
        };
        realtimeMultiplayerAdapter.submitMove(movePayload).catch((err) => {
          console.error("Failed to submit move:", err);
        });
      }

      if (socketRef.current && !isMultiplayer) {
        socketRef.current.emit('move', {
          gameId: gameId.current,
          move: { from: pendingPromotion.from, to: pendingPromotion.to, promotion: pieceType },
          userId: playerData.uid
        });
      }
    }
    
    setPendingPromotion(null);
    setShowPromotionPopup(false);
  };

  const updateCheckInfo = () => {
    if (chess.isCheck()) {
      const turn = chess.getTurn();
      const board = chess.getBoard();
      let kingSquare = '';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type === 'k' && p.color === turn) {
            kingSquare = String.fromCharCode(97 + c) + (8 - r);
            break;
          }
        }
        if (kingSquare) break;
      }

      // Find the checker
      // We can't easily get opponent moves from chess.js without switching turn
      // So we just look at the last move if it was a check
      const history = chess.getHistory({ verbose: true }) as any[];
      const lastMove = history[history.length - 1];
      if (lastMove && lastMove.san.includes('+')) {
        setCheckInfo({ king: kingSquare, checker: lastMove.to });
        playSound('check');
      } else {
        // If it wasn't the last move (e.g. discovered check), we might need more logic
        // for now, let's just use the last move's 'to' as a fallback if it's a check
        if (lastMove) {
           setCheckInfo({ king: kingSquare, checker: lastMove.to });
           playSound('check');
        }
      }
    } else {
      setCheckInfo(null);
    }
  };

  // Multiplayer room, presence, moves, results, draw offers, and network subscriptions
  useEffect(() => {
    if (!isMultiplayer || !multiplayerConfig || !user) return;

    let isMounted = true;
    const roomId = multiplayerConfig.roomId;

    // Fetch room metadata once so that player names/roles can be initialized in UI
    getRoom(roomId).then((room) => {
      if (room && isMounted) {
        setRoomData(room);
      }
    });

    realtimeMultiplayerAdapter.initFriendMatch({
      roomId,
      role: multiplayerConfig.role,
      color: multiplayerConfig.color,
      uid: user.uid,
      displayName: playerData.name || user.displayName || 'Player',
      onReady: () => {
        console.log('[GameScreen] Multiplayer transport initialized.');
      },
      onOpponentMove: (oppMove) => {
        if (!isMounted) return;
        // Apply opponent move only if moveNumber matches the next expected move
        if (oppMove.moveNumber === history.length + 1) {
          const moveResult = chess.makeMove({
            from: oppMove.from,
            to: oppMove.to,
            promotion: oppMove.promotion
          });
          if (moveResult) {
            setBoard(chess.getBoard());
            setTurn(chess.getTurn());
            setLastMove({ from: oppMove.from, to: oppMove.to });
            updateCheckInfo();
            recordMove(moveResult);
            playSound('move');
            checkGameOver();
          }
        }
      },
      onMatchEnd: (result) => {
        if (!isMounted || gameOver) return;
        const reason = result.reason;
        const winnerUid = result.winnerUid;
        let winText = '';
        if (winnerUid) {
          const isWinnerMe = winnerUid === user.uid;
          winText = isWinnerMe ? `YOU WON` : `OPPONENT WON`;
        } else {
          winText = `MATCH DRAW`;
        }
        
        const finalResult: 'win' | 'loss' | 'draw' | 'abandoned' = 
          result.status === 'abandoned' ? 'abandoned' :
          !winnerUid ? 'draw' :
          winnerUid === user.uid ? 'win' : 'loss';

        const targetOpponentUid = multiplayerConfig.role === 'host' ? roomData?.guestUid : roomData?.hostUid;
        const opponentUid = targetOpponentUid || (multiplayerConfig.role === 'host' ? 'guest' : 'host');
        const opponentName = multiplayerConfig.role === 'host' ? (roomData?.guestName || 'Guest') : (roomData?.hostName || 'Host');

        const historyItem = {
          roomId,
          opponentUid,
          opponentName,
          result: finalResult,
          reason: result.reason,
          playedAt: result.endedAt,
          moves: history.length
        };

        addMultiplayerHistoryItem(playerData, historyItem);

        setGameOver(`${winText} - ${reason.toUpperCase()}`);
        playSound('gameover');
        if (winnerUid === user.uid) {
          playSound('clapping');
          confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ['#d9ad33', '#ffffff', '#a855f7'] });
        }
      },
      onOpponentPresence: (online) => {
        if (!isMounted) return;
        setOpponentOnline(online);
      },
      onDrawOfferReceived: (received) => {
        if (!isMounted) return;
        setDrawOfferReceived(received);
      },
      onDrawOfferSent: (sent) => {
        if (!isMounted) return;
        setDrawOfferSent(sent);
      }
    });

    // RTT WebSocket Latency Indicator Setup
    lastPongReceivedTime.current = Date.now();
    const initialStatus = realtimeClient.getRealtimeStatus();
    if (initialStatus === 'connecting') {
      setLatencyText('Ping...');
      setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
    } else if (initialStatus === 'reconnecting') {
      setLatencyText('Reconnecting...');
      setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
    } else if (initialStatus === 'failed' || initialStatus === 'closed' || initialStatus === 'idle') {
      setLatencyText('Offline');
      setLatencyColorClass('bg-red-500/20 border-red-500/30 text-red-500');
    } else {
      setLatencyText('Connected');
      setLatencyColorClass('bg-green-500/10 border-green-500/20 text-green-500');
    }

    const checkLatencyInterval = setInterval(() => {
      const currentStatus = realtimeClient.getRealtimeStatus();
      if (currentStatus === 'connecting') {
        setLatencyText('Ping...');
        setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
      } else if (currentStatus === 'reconnecting') {
        setLatencyText('Reconnecting...');
        setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
      } else if (currentStatus === 'failed' || currentStatus === 'closed' || currentStatus === 'idle') {
        setLatencyText('Offline');
        setLatencyColorClass('bg-red-500/20 border-red-500/30 text-red-500');
      } else if (currentStatus === 'connected') {
        const timeSinceLastPong = Date.now() - lastPongReceivedTime.current;
        if (timeSinceLastPong > 10000) {
          setLatencyText('Reconnecting...');
          setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
        }
      }
    }, 1000);

    realtimeClient.onLatencyCallback = (rtt) => {
      if (!isMounted) return;
      if (rtt === null) {
        setLatencyText('Offline');
        setLatencyColorClass('bg-red-500/20 border-red-500/30 text-red-500');
      } else {
        lastPongReceivedTime.current = Date.now();
        setLatencyText(`${rtt}ms`);
        if (rtt > 250) {
          setLatencyColorClass('bg-red-500/20 border-red-500/30 text-red-500');
        } else if (rtt > 100) {
          setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
        } else {
          setLatencyColorClass('bg-green-500/10 border-green-500/20 text-green-500');
        }
      }
    };

    realtimeClient.onRealtimeStatus((status) => {
      if (!isMounted) return;
      if (status === 'connecting') {
        setLatencyText('Ping...');
        setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
      } else if (status === 'reconnecting') {
        setLatencyText('Reconnecting...');
        setLatencyColorClass('bg-yellow-500/20 border-yellow-500/30 text-yellow-500');
      } else if (status === 'failed' || status === 'closed') {
        setLatencyText('Offline');
        setLatencyColorClass('bg-red-500/20 border-red-500/30 text-red-500');
      }
    });

    // Network status listener
    const unsubscribeNetwork = subscribeToNetworkChanges((online) => {
      if (!online) {
        console.warn("[GameScreen] Network offline detected during multiplayer.");
      }
    });

    return () => {
      isMounted = false;
      realtimeMultiplayerAdapter.dispose();
      unsubscribeNetwork();
      clearInterval(checkLatencyInterval);
      realtimeClient.onLatencyCallback = null;
      realtimeClient.onStatusCallback = null;
    };
  }, [isMultiplayer, multiplayerConfig?.roomId, roomData?.guestUid, roomData?.hostUid, history.length, gameOver]);

  // Opponent reconnect countdown timer
  useEffect(() => {
    if (!isMultiplayer || gameOver) return;
    
    let timer: any = null;
    if (!opponentOnline) {
      setReconnectTimeLeft(60);
      timer = setInterval(() => {
        setReconnectTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setReconnectTimeLeft(null);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [opponentOnline, isMultiplayer, gameOver]);

  useEffect(() => {
    if (!gameOver && !isLocalVS && playerColor && turn !== playerColor && !isGameInteractionBlocked) {
      if (isAIThinking) return;
      setIsAIThinking(true);

      const character = AI_CHARACTERS.find(c => c.id === activeCharacterId) || AI_CHARACTERS[0];
      const brain = EngineBrain.create(character, chess);
      const { moveDelayMs } = getBotProfile(character);

      // Select random taunt only during AI thinking, max once every 4 moves, 25% chance
      movesSinceLastTaunt.current++;
      if (character && (character.taunts || []).length > 0 && movesSinceLastTaunt.current >= 4 && Math.random() < 0.25) {
        const characterTaunts = character.taunts || [];
        const randomTaunt = characterTaunts[Math.floor(Math.random() * characterTaunts.length)];
        setAiTaunt(randomTaunt);
        movesSinceLastTaunt.current = 0;
        
        if (tauntTimeoutRef.current) clearTimeout(tauntTimeoutRef.current);
        tauntTimeoutRef.current = setTimeout(() => {
          setAiTaunt(null);
        }, 3000);
      }

      const timer = setTimeout(async () => {
        try {
          const result = await brain.computeMove();
          setAiCalcTime(result.thinkTimeMs);
          setLastMoveLatency(result.thinkTimeMs);

          if (result.move) {
            const move = chess.makeMove(result.move);
            if (move) {
              if (move.captured) {
                setCapturedPieces(prev => {
                  const next = { w: [...prev.w], b: [...prev.b] };
                  if (move.color === 'w') {
                    next.b.push(move.captured);
                  } else {
                    next.w.push(move.captured);
                  }
                  return next;
                });
              }
              setBoard(chess.getBoard());
              setTurn(chess.getTurn());
              setLastMove({ from: move.from, to: move.to });
              updateCheckInfo();
              recordMove(move);
              playSound('move');
            }
          }
          checkGameOver();
        } catch (err) {
          console.error("EngineBrain error:", err);
          checkGameOver();
        } finally {
          brain.dispose();
          setIsAIThinking(false);
        }
      }, moveDelayMs);

      return () => { clearTimeout(timer); brain.cancel(); brain.dispose(); setIsAIThinking(false); };
    }
  }, [turn, gameOver, activeCharacterId, isLocalVS, playerColor, isGameInteractionBlocked]);

  const handleResign = () => {
    if (isMultiplayer && multiplayerConfig && user) {
      realtimeMultiplayerAdapter.resign().catch(console.error);
      setIsMenuOpen(false);
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('resign', {
        gameId: gameId.current,
        userId: playerData.uid
      });
    }
    setIsMenuOpen(false);
    if (tauntTimeoutRef.current) {
      clearTimeout(tauntTimeoutRef.current);
      tauntTimeoutRef.current = null;
    }
    setAiTaunt(null);
  };

  const triggerEndMatchCommentary = (result: 'win' | 'loss' | 'draw') => {
    const isCommentaryEnabled = playerData.commentaryEnabled !== false;
    if (!isCommentaryEnabled) return;

    let trigger: CommentaryTrigger = 'match_draw';
    if (result === 'win') trigger = 'match_win';
    else if (result === 'loss') trigger = 'match_loss';

    const commContext = {
      roomMode: (isMultiplayer ? 'friend' : (activeCharacterId ? 'comp' : 'offline')) as any,
      playerColor: playerColor || 'w',
      currentTurn: chess.getTurn(),
      moveNumber: Math.floor(history.length / 2) + 1,
      isCheckmate: chess.isCheckmate(),
      characterId: activeCharacterId || undefined,
      tierId: aiCharacter?.tier,
    };

    const reaction = selectCommentaryLine(commContext, [trigger]);
    if (reaction) {
      setActiveCommentary(reaction);
    }
  };

  const checkGameOver = () => {
    if (chess.isCheckmate()) {
      playSound('gameover');
      const winner = chess.getTurn() === 'w' ? 'Black' : 'White';
      const playerWon = isLocalVS ? true : (playerColor === 'w' && winner === 'White') || (playerColor === 'b' && winner === 'Black');
      
      if (playerWon) {
        playSound('clapping');
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, colors: ['#d9ad33', '#ffffff', '#a855f7'] });
      }

      triggerEndMatchCommentary(playerWon ? 'win' : 'loss');

      if (isMultiplayer && multiplayerConfig && user) {
        const winnerUid = winner === 'White' ? roomData?.hostUid : roomData?.guestUid;
        realtimeMultiplayerAdapter.submitResult({
          winnerUid: winnerUid || null,
          winnerColor: winner === 'White' ? 'w' : 'b',
          status: 'completed',
          reason: 'checkmate',
          endedAt: Date.now()
        }).catch(console.error);
        return;
      }

      // Apply AI career progression and rewards
      if (!isLocalVS && activeCharacterId && playerData.aiProgress) {
        const result: 'win' | 'loss' = playerWon ? 'win' : 'loss';
        handleMatchCompletion(result, 'checkmate');
      }

      setGameOver(`${winner.toUpperCase()} ${t.victory} - ${t.checkmate}`);
      if (tauntTimeoutRef.current) {
        clearTimeout(tauntTimeoutRef.current);
        tauntTimeoutRef.current = null;
      }
      setAiTaunt(null);
    } else if (chess.isDraw()) {
      playSound('gameover');
      let reason = t.draw;
      if (chess.isStalemate()) reason = t.stalemate;
      else if (chess.isThreefoldRepetition()) reason = t.drawByRepetition;
      else if (chess.isInsufficientMaterial()) reason = t.drawByMaterial;

      triggerEndMatchCommentary('draw');

      if (isMultiplayer && multiplayerConfig && user) {
        realtimeMultiplayerAdapter.submitResult({
          winnerUid: null,
          winnerColor: null,
          status: 'completed',
          reason: 'draw',
          endedAt: Date.now()
        }).catch(console.error);
        return;
      }
      
      // Apply AI progression and rewards
      if (!isLocalVS && activeCharacterId && playerData.aiProgress) {
        handleMatchCompletion('draw', 'draw');
      }
      
      setGameOver(reason);
      if (tauntTimeoutRef.current) {
        clearTimeout(tauntTimeoutRef.current);
        tauntTimeoutRef.current = null;
      }
      setAiTaunt(null);
    }
  };

  const handleUndo = () => {
    if (gameOver || isMultiplayer) return;
    if (isAIThinking) return; // Block undo while AI is actively thinking to avoid race conditions!

    const depth = isLocalVS ? 2 : 1;
    if (undoStackRef.current.length < depth) return;

    if (isLocalVS) {
      playSound('click');
      let snapshot: any = null;
      for (let i = 0; i < depth; i++) {
        snapshot = undoStackRef.current.pop();
      }
      if (snapshot) {
        chess.load(snapshot.fen);
        setBoard(chess.getBoard());
        setTurn(snapshot.turn);
        setLastMove(snapshot.lastMove);
        setHistory(snapshot.history);
        setCapturedPieces(snapshot.capturedPieces);
        setWhiteTime(snapshot.whiteTime);
        setBlackTime(snapshot.blackTime);
      }
      setSelectedSquare(null);
      setValidMoves([]);
      updateCheckInfo();
      return;
    }

    // AI Match Undo Economy
    const character = AI_CHARACTERS.find(c => c.id === activeCharacterId) || AI_CHARACTERS[0];
    const tier = character?.tier || 'beginner';

    if (tier === 'master' || tier === 'grandmaster') {
      // Cup/Tournament/Ranked: undo disabled
      alert("Undo is disabled in Cup/Ranked matches.");
      return;
    }

    let requiresToken = false;
    let newFreeUndosUsed = freeUndosUsed;

    if (tier === 'beginner' || tier === 'learner') {
      if (freeUndosUsed < 1) {
        newFreeUndosUsed = 1;
      } else {
        requiresToken = true;
      }
    } else if (tier === 'intermediate' || tier === 'hard') {
      requiresToken = true;
    }

    if (requiresToken) {
      const currentTokens = playerData.undoTokens !== undefined ? playerData.undoTokens : 0;
      if (currentTokens <= 0) {
        setShowUndoPackModal(true);
        return;
      }
      // Decrement token
      onUpdatePlayerData({
        undoTokens: currentTokens - 1
      });
    }

    setFreeUndosUsed(newFreeUndosUsed);

    playSound('click');
    const snapshot = undoStackRef.current.pop();
    if (snapshot) {
      chess.load(snapshot.fen);
      setBoard(chess.getBoard());
      setTurn(snapshot.turn);
      setLastMove(snapshot.lastMove);
      setHistory(snapshot.history);
      setCapturedPieces(snapshot.capturedPieces);
      setWhiteTime(snapshot.whiteTime);
      setBlackTime(snapshot.blackTime);
    }
    setSelectedSquare(null);
    setValidMoves([]);
    setIsAIThinking(false);
    updateCheckInfo();
  };

  const resetGame = () => {
    if (tauntTimeoutRef.current) {
      clearTimeout(tauntTimeoutRef.current);
      tauntTimeoutRef.current = null;
    }
    setAiTaunt(null);
    movesSinceLastTaunt.current = 4;
    chess.reset();
    setBoard(chess.getBoard());
    setTurn(chess.getTurn());
    setSelectedSquare(null);
    setValidMoves([]);
    setGameOver(null);
    setFreeUndosUsed(0);
    setLastMove(null);
    setHistory([]);
    setCapturedPieces({ w: [], b: [] });
    undoStackRef.current = [];
    setWhiteTime(0);
    setBlackTime(0);
    setGameStarted(false);
    setShowReview(false);
    setEloChange(null);
    setShowDeclareConfirm(false);
    if (!isLocalVS) {
      setPlayerColor(playerData.preferredSide);
      gameStartTime.current = Date.now();
      if (activeCharacterId) {
        matchIdRef.current = createMatchSession(activeCharacterId);
      }
    }
    localStorage.removeItem('chess_game_session');
  };

  const handleDeclareDraw = () => {
    if (isMultiplayer && multiplayerConfig && user) {
      realtimeMultiplayerAdapter.offerDraw().catch(console.error);
      setShowDeclareConfirm(false);
      return;
    }

    setGameOver(t.draw + " - Declared");
    setShowDeclareConfirm(false);
    
    const endTime = Date.now();
    const duration = gameStartTime.current ? Math.floor((endTime - gameStartTime.current) / 1000) : 0;
    const isWhite = playerColor === 'w';

    if (!isLocalVS && activeCharacterId && playerData.aiProgress) {
      onUpdatePlayerData({
        whiteTime: isWhite ? playerData.whiteTime + duration : playerData.whiteTime,
        blackTime: !isWhite ? playerData.blackTime + duration : playerData.blackTime,
      });
      handleMatchCompletion('draw', 'draw');
    } else if (!isLocalVS) {
      onUpdatePlayerData({
        whiteTime: isWhite ? playerData.whiteTime + duration : playerData.whiteTime,
        blackTime: !isWhite ? playerData.blackTime + duration : playerData.blackTime,
      });
    }
    if (tauntTimeoutRef.current) {
      clearTimeout(tauntTimeoutRef.current);
      tauntTimeoutRef.current = null;
    }
    setAiTaunt(null);
  };

  const handleAcceptDraw = async () => {
    if (!isMultiplayer || !multiplayerConfig || !user) return;
    playSound('click');
    await realtimeMultiplayerAdapter.respondDraw(true).catch(console.error);
    setDrawOfferReceived(false);
  };

  const handleDeclineDraw = async () => {
    if (!isMultiplayer || !multiplayerConfig || !user) return;
    playSound('click');
    await realtimeMultiplayerAdapter.respondDraw(false).catch(console.error);
    setDrawOfferReceived(false);
    setDrawOfferSent(false);
    if (tauntTimeoutRef.current) {
      clearTimeout(tauntTimeoutRef.current);
      tauntTimeoutRef.current = null;
    }
    setAiTaunt(null);
  };


  const navigateWithCleanup = (screen: AppScreen) => {
    if (tauntTimeoutRef.current) {
      clearTimeout(tauntTimeoutRef.current);
      tauntTimeoutRef.current = null;
    }
    setAiTaunt(null);
    setHistory([]);
    setShowReview(false);

    if (isMultiplayer && multiplayerConfig) {
      cleanupRoomListeners(multiplayerConfig.roomId);
    }

    onNavigate(screen);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const postMatchLine = React.useMemo(() => {
    if (!aiCharacter) return null;
    if (!gameOver) return null;
    const isDraw = chess.isDraw() || gameOver.includes(t.draw) || gameOver.toLowerCase().includes('draw') || gameOver.toLowerCase().includes('stalemate');
    if (isDraw) {
      return aiCharacter.drawLine || "A balanced battle.";
    }
    const isWin = gameOver.includes(t.victory);
    if (isWin) {
      return aiCharacter.playerWinLine || "You played well.";
    }
    return aiCharacter.playerLossLine || "The board belongs to me this time.";
  }, [gameOver, aiCharacter, t]);

  return (
    <div 
      className="w-full h-full bg-[#030204] relative overflow-hidden" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {isSimulatingTournament && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-50">
          <Loader2 size={36} className="animate-spin text-[#d9ad33]" />
          <h3 className="text-lg font-bold text-white uppercase tracking-widest font-serif">Simulating Tournament Matches</h3>
          <p className="text-xs text-white/60 uppercase tracking-widest">Calculating round-robin standings...</p>
        </div>
      )}
      <PerformanceOverlay 
        show={!!playerData.showDebugOverlay} 
        rtt={latency}
        boardLoadTime={boardLoadTime}
        aiCalcTime={aiCalcTime}
        lowGraphics={!!playerData.lowGraphics}
        aiEngineType={aiCharacter ? aiCharacter.engine : 'N/A'}
        aiDepth={aiCharacter ? getAIDifficultySettings(aiCharacter).depth : null}
        maxThinkTimeMs={aiCharacter ? getAIDifficultySettings(aiCharacter).maxThinkTimeMs : null}
        lastMoveLatency={lastMoveLatency}
      />
      {isGameLoading && (
        <GameLoadingScreen 
          progress={loadingProgress} 
          message={loadingProgress >= 50 && aiCharacter ? `"${aiCharacter.introLine || 'Prepare your move.'}"` : loadingMessage} 
        />
      )}
      {latencyText === 'Ping...' && isGameLoading && showNetworkWarning && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] bg-yellow-500/90 text-black font-sans font-semibold text-[9px] md:text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse pointer-events-auto">
          <span>⚠️ Your network connection is low. Please wait...</span>
        </div>
      )}
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-[#1a0f0a] via-[#030204] to-[#1a0f0a]" />

      {/* Top Header Bar */}
      {!showReview && (
        <div 
          className="absolute top-0 left-0 w-full flex justify-between items-start z-30 pointer-events-none"
          style={{
            paddingLeft: 'calc(1.5rem + env(safe-area-inset-left))',
            paddingRight: 'calc(1.5rem + env(safe-area-inset-right))',
            paddingTop: 'calc(1.5rem + env(safe-area-inset-top))'
          }}
        >
        {/* Left Side Actions */}
        <div className="flex gap-1 md:gap-2 pointer-events-auto">
          <AnimatePresence>
            {!isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex gap-1 md:gap-2"
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (isGameInteractionBlocked) return;
                    playSound('click');
                    navigateWithCleanup('Home');
                  }}
                  className="p-1.5 md:p-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg md:rounded-xl text-white/60 hover:text-white transition-all shadow-2xl"
                  title={t.back}
                >
                  <ChevronLeft size={16} className={`md:w-5 md:h-5 ${isRtl ? "rotate-180" : ""}`} />
                </motion.button>

                {!gameOver && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (isGameInteractionBlocked) return;
                        playSound('click');
                        setIsMenuOpen(true);
                      }}
                      className="p-1.5 md:p-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg md:rounded-xl text-[#d9ad33] hover:bg-white/10 transition-all shadow-2xl"
                      title={t.menu}
                    >
                      <Menu size={16} className="md:w-5 md:h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (isGameInteractionBlocked) return;
                        playSound('click');
                        onUpdatePlayerData({ viewMode: playerData.viewMode === '2d' ? '3d' : '2d' });
                      }}
                      className="p-1.5 md:p-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg md:rounded-xl text-[#d9ad33] hover:bg-white/10 transition-all shadow-2xl flex items-center justify-center min-w-[36px] md:min-w-[50px]"
                      title={playerData.viewMode === '2d' ? t.view3d : t.view2d}
                    >
                      <span className="text-[8px] md:text-[10px] font-black tracking-tighter">
                        {playerData.viewMode === '2d' ? '3D' : '2D'}
                      </span>
                    </motion.button>
                    
                    {/* Latency Indicator */}
                    <div 
                      className={cn(
                        "p-1.5 md:p-2.5 backdrop-blur-xl border rounded-lg md:rounded-xl transition-all shadow-2xl flex flex-col items-center justify-center min-w-[36px] md:min-w-[50px] cursor-help",
                        latencyColorClass
                      )}
                      title={
                        latencyText === 'Ping...'
                          ? 'Your network connection is low. Please wait...'
                          : latencyText === 'Offline'
                            ? 'Disconnected from the engine. Operating in offline local fallback mode.'
                            : latencyText === 'Reconnecting...'
                              ? 'Connection lost. Reconnecting to engine...'
                              : `Ping: ${latencyText}. Lower is better for multiplayer and online engine queries.`
                      }
                    >
                      <span className="text-[10px] md:text-xs font-black">
                        {latencyText.replace(/[^0-9]/g, '') || (latencyText === 'Offline' ? '--' : '...')}
                      </span>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (isGameInteractionBlocked) return;
                        playSound('click');
                        setShowDeclareConfirm(true);
                      }}
                      className="p-1.5 md:p-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg md:rounded-xl text-[#d9ad33] hover:bg-white/10 transition-all shadow-2xl flex items-center justify-center min-w-[36px] md:min-w-[50px]"
                      title="Declare Draw"
                    >
                      <span className="text-[8px] md:text-[10px] font-black tracking-tighter uppercase">
                        Declare
                      </span>
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side Info */}
        <div className="flex flex-col items-end gap-1 md:gap-3 pointer-events-auto">
          <div className="flex items-center gap-1 md:gap-3">
            {playerData.viewMode === '3d' && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (isGameInteractionBlocked) return;
                  playSound('click');
                  setIsCameraLocked(!isCameraLocked);
                }}
                className={cn(
                  "p-1.5 md:p-2.5 backdrop-blur-xl border rounded-lg md:rounded-xl transition-all shadow-2xl",
                  isCameraLocked 
                    ? "bg-[#d9ad33] border-[#f5d666] text-black" 
                    : "bg-black/40 border-white/10 text-white/60 hover:text-[#d9ad33]"
                )}
                title={isCameraLocked ? "Unlock Camera" : "Lock Camera"}
              >
                <Box size={14} className="md:w-4 md:h-4" />
              </motion.button>
            )}

            {!isMultiplayer && (!activeCharacterId || (AI_CHARACTERS.find(c => c.id === activeCharacterId)?.tier !== 'master' && AI_CHARACTERS.find(c => c.id === activeCharacterId)?.tier !== 'grandmaster')) && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (isGameInteractionBlocked) return;
                  handleUndo();
                }}
                className="p-1.5 md:p-2.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg md:rounded-xl text-white/60 hover:text-[#d9ad33] transition-all shadow-2xl"
                title="Undo Move"
              >
                <Undo2 size={14} className="md:w-4 md:h-4" />
              </motion.button>
            )}

            <motion.div 
              key={turn}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 px-2 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl shadow-2xl flex items-center gap-1.5 md:gap-3"
            >
              <div className="flex flex-col items-end">
                <span className="text-[6px] md:text-[8px] text-[#8c7a52] font-bold tracking-[0.2em] uppercase">Time</span>
                <span className="text-[10px] md:text-sm font-bold text-[#d9ad33] font-mono">{formatTime(turn === 'w' ? whiteTime : blackTime)}</span>
              </div>
              <div className="w-[1px] h-6 bg-white/10 mx-1" />
              <div className="flex flex-col items-end">
                <span className="text-[6px] md:text-[8px] text-[#8c7a52] font-bold tracking-[0.2em] uppercase">Turn</span>
                <span className="text-[10px] md:text-sm font-bold text-white tracking-widest font-serif">{turn === 'w' ? "WHITE" : "BLACK"}</span>
              </div>
              <div className={cn("w-1 h-1 md:w-2 md:h-2 rounded-full animate-pulse", turn === 'w' ? "bg-white shadow-[0_0_10px_white]" : "bg-[#d9ad33] shadow-[0_0_10px_#d9ad33]")} />
            </motion.div>
          </div>
          
          {!isLocalVS && (
            <div className="flex flex-col items-end gap-1">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 px-2 md:px-3 py-1 md:py-1.5 rounded-lg text-[6px] md:text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase">
                Vs {opponentName}
              </div>
              <AnimatePresence>
                {aiTaunt && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-[7px] md:text-[9px] text-[#d9ad33] italic font-medium max-w-[120px] md:max-w-[180px] text-right truncate font-sans pointer-events-auto"
                    title={aiTaunt}
                  >
                    "{aiTaunt}"
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Game View (2D or 3D) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className={cn("w-full h-full flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 pointer-events-auto gap-2 md:gap-3", playerData.viewMode !== '2d' && "hidden")}>
          {/* Top Tray: Opponent's Captured Pieces (from active player perspective) */}
          <div className="w-full max-w-[min(90vw,90vh,600px)] flex justify-between items-center px-1">
            <span className="text-[9px] md:text-[10px] text-white/40 font-bold tracking-wider uppercase font-sans">
              {isLocalVS ? (turn === 'w' ? "Black's Captures" : "White's Captures") : "Opponent's Captures"}
            </span>
            <RenderCaptured2D 
              pieces={playerColor === 'b' ? capturedPieces.b : capturedPieces.w} 
              isWhitePiece={playerColor === 'b'} 
            />
          </div>

          <div className="w-full max-w-[min(90vw,90vh,600px)] aspect-square">
            <ChessBoard2D
              board={board}
              selectedSquare={selectedSquare}
              validMoves={validMoves}
              lastMove={lastMove}
              onSquareClick={handleSquareClick}
              playerColor={isLocalVS ? turn : playerColor}
              checkInfo={checkInfo}
              turn={turn}
            />
          </div>

          {/* Bottom Tray: Player's Captured Pieces */}
          <div className="w-full max-w-[min(90vw,90vh,600px)] flex justify-between items-center px-1">
            <span className="text-[9px] md:text-[10px] text-[#d9ad33]/70 font-bold tracking-wider uppercase font-sans">
              {isLocalVS ? (turn === 'w' ? "White's Captures" : "Black's Captures") : "Your Captures"}
            </span>
            <RenderCaptured2D 
              pieces={playerColor === 'b' ? capturedPieces.w : capturedPieces.b} 
              isWhitePiece={playerColor !== 'b'} 
            />
          </div>
        </div>
        <div className={cn("w-full h-full pointer-events-auto touch-none", playerData.viewMode !== '3d' && "hidden")}>
          <Canvas 
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={[1, 1.5]}
            gl={{ 
              antialias: true,
              powerPreference: "high-performance",
              stencil: false,
              depth: true
            }}
          >
          <PerspectiveCamera 
            makeDefault 
            fov={45} 
            position={[0, 10, -12]}
          />
          <CameraResetter playerColor={playerColor} />
          <CameraDirector 
            turn={turn} 
            playerColor={playerColor} 
            isLocalVS={isLocalVS} 
            isCameraLocked={isCameraLocked} 
          />
          <OrbitControls 
            enabled={playerData.viewMode === '3d' && !isCameraLocked}
            enablePan={false} 
            enableDamping={true}
            dampingFactor={0.05}
            maxDistance={18} 
            minDistance={5} 
            target={[0, 1.5, 0]}
            rotateSpeed={Math.min(2.0, (playerData.cameraSensitivity || 1.0) * 0.8)}
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI / 2 - 0.1}
            makeDefault
          />
          
          <Suspense fallback={
            <Html center>
              <div className="bg-slate-900/80 px-4 py-2 rounded-lg text-white/80 font-inter text-sm backdrop-blur-sm border border-white/10 whitespace-nowrap">
                Loading 3D Board...
              </div>
            </Html>
          }>
            <CameraGuard />
            
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 15, 10]} intensity={1.0} color="#fff" castShadow={!playerData.lowGraphics} />
            <pointLight position={[-10, 15, 10]} intensity={1.0} color="#fff" castShadow={!playerData.lowGraphics} />
            <pointLight position={[10, 15, -10]} intensity={1.0} color="#fff" castShadow={!playerData.lowGraphics} />
            <pointLight position={[-10, 15, -10]} intensity={1.0} color="#fff" castShadow={!playerData.lowGraphics} />
            
            <spotLight position={[0, 15, 0]} angle={0.8} penumbra={1} intensity={1.5} castShadow={!playerData.lowGraphics} />
            <pointLight position={[0, 8, 0]} intensity={0.4} color="#ffbd52" />

            <ChessBoard3D 
              board={board} 
              onSquareClick={handleSquareClick} 
              selectedSquare={selectedSquare}
              validMoves={validMoves}
              lastMove={lastMove}
              checkInfo={checkInfo}
              chess={chess}
              setBoard={setBoard}
              setTurn={setTurn}
              setLastMove={setLastMove}
              updateCheckInfo={updateCheckInfo}
              checkGameOver={checkGameOver}
              setSelectedSquare={setSelectedSquare}
              setValidMoves={setValidMoves}
              showHints={playerData.showHints}
              onSelect={() => { lastSelectTime.current = Date.now(); }}
              selectedPieceSet={playerData.selectedPieceSet || 'classic'}
              boardTheme={playerData.boardTheme || 'classic'}
              capturedPieces={capturedPieces}
              isLocalVS={isLocalVS}
              turn={turn}
              playerColor={playerColor}
              lowGraphics={playerData.lowGraphics || false}
              isAIThinking={isAIThinking}
              onLoad={() => setIs3DLoaded(true)}
            />

            <Room />
          </Suspense>
          <Environment preset="apartment" />
        </Canvas>
      </div>
      
      {/* Promotion Popup */}
      <AnimatePresence>
        {showPromotionPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="play-popup bg-[#1a1a1e] border-2 border-[#d9ad33] text-center shadow-[0_0_50px_rgba(217,173,51,0.3)]"
            >
              <h3 className="play-popup-title text-2xl font-bold text-[#d9ad33] mb-6 font-serif tracking-widest uppercase">{t.promotePawn}</h3>
              <p className="text-white/60 text-xs mb-8 tracking-widest uppercase">{t.selectLevel}</p>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: 'q', label: t.queen },
                  { type: 'r', label: t.rook },
                  { type: 'b', label: t.bishop },
                  { type: 'n', label: t.knight }
                ].map((p) => (
                  <motion.button
                    key={p.type}
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(217, 173, 51, 0.1)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePromotion(p.type)}
                    className="p-4 play-mode-button bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 group transition-all"
                  >
                    <div className="text-[#d9ad33] group-hover:scale-110 transition-transform">
                      {/* We can use simple text or icons if we had them, but labels are fine for now */}
                      <span className="text-2xl font-serif">{p.type.toUpperCase()}</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-white/40 group-hover:text-[#d9ad33]">{p.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Game Prompt */}
      <AnimatePresence>
        {showResumePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="play-popup bg-[#1a1a1e] border-2 border-[#d9ad33] text-center shadow-[0_0_50px_rgba(217,173,51,0.3)]"
            >
              <div className="w-12 h-12 bg-[#d9ad33]/10 rounded-full flex items-center justify-center text-[#d9ad33] mx-auto mb-4">
                <RotateCcw size={24} />
              </div>
              <h3 className="play-popup-title text-2xl font-bold text-[#d9ad33] mb-4 font-serif tracking-widest uppercase">{t.continueGame}?</h3>
              <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">{(t as any).resumePrompt || "We found an unfinished game. Would you like to resume it?"}</p>
              
              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleContinueGame}
                  className="w-full play-mode-button bg-[#d9ad33] text-black font-bold tracking-widest text-xs uppercase hover:brightness-110 transition-all"
                >
                  {t.resume}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartNewGame}
                  className="w-full play-mode-button bg-white/5 border border-white/10 text-white/60 font-bold tracking-widest text-xs uppercase hover:bg-white/10 transition-all"
                >
                  {t.startNewGame}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Selection Modal Removed */}

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-[#d9ad33]/40 text-center shadow-[0_0_100px_rgba(217,173,51,0.15)] relative overflow-hidden custom-scrollbar"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-[#d9ad33]" />
                
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-4"
                >
                  <h2 className="play-popup-title text-3xl md:text-5xl font-bold text-white font-serif tracking-tighter uppercase mb-1">
                    {gameOver.includes(t.victory) ? "BRILLIANT!" : gameOver.includes(t.defeat) ? "DEFEAT" : "DRAW"}
                  </h2>
                  <div className="h-0.5 w-16 bg-[#d9ad33] mx-auto rounded-full" />
                </motion.div>

                <div className="flex justify-between items-center mb-6 px-4">
                  <div className="text-center">
                    <div className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mb-0.5">White</div>
                    <div className="text-xs font-bold text-white font-serif">{whitePlayerName}</div>
                    <div className="text-[8px] text-[#d9ad33] mt-0.5">Time: {formatTime(whiteTime)}</div>
                  </div>
                  <div className="text-[#d9ad33] font-serif text-xl italic">vs</div>
                  <div className="text-center">
                    <div className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mb-0.5">Black</div>
                    <div className="text-xs font-bold text-white font-serif">{blackPlayerName}</div>
                    <div className="text-[8px] text-[#d9ad33] mt-0.5">Time: {formatTime(blackTime)}</div>
                  </div>
                </div>

                <p className="text-[#b38f42] text-[10px] md:text-xs mb-3 font-bold tracking-[0.2em] uppercase bg-[#d9ad33]/10 py-2.5 rounded-xl border border-[#d9ad33]/20">
                  {gameOver}
                  {aiCharacter && postMatchLine && (
                    <span className="block mt-2 pt-2 border-t border-[#d9ad33]/20 normal-case font-normal text-white/85 italic font-sans text-xs">
                      "{postMatchLine}"
                    </span>
                  )}
                </p>
                
                {/* ELO Change Indicator */}
                {eloChange !== null && !isLocalVS && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mb-4 flex items-center justify-center gap-3"
                  >
                    <span className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase">ELO</span>
                    <span className={cn(
                      "text-xl font-black font-serif",
                      eloChange > 0 ? "text-green-400" : eloChange < 0 ? "text-red-400" : "text-white/40"
                    )}>
                      {eloChange > 0 ? `+${eloChange}` : eloChange === 0 ? '±0' : eloChange}
                    </span>
                    <span className="text-[10px] text-white/40 font-bold">{playerData.aiProgress?.elo || playerData.rating}</span>
                  </motion.div>
                )}

                {/* Progression Status Indicator */}
                {!isLocalVS && playerData.aiProgress && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mb-4 text-[10px] sm:text-xs text-[#d9ad33] font-bold tracking-widest uppercase flex flex-col items-center gap-1"
                  >
                    <span>TIER: {String(playerData.aiProgress.tier).replace('_', ' ')}</span>
                    {playerData.aiProgress.tier === 'master' ? (
                      <>
                        <span>Cup {playerData.aiProgress.masterCup.currentCup} Progress</span>
                        <span className="text-white/60 text-[9px] lowercase mt-0.5 font-sans">
                          {playerData.aiProgress.masterCup.winsInCup} wins | {playerData.aiProgress.masterCup.lossesInCup} losses (Match {playerData.aiProgress.masterCup.currentMatch}/4)
                        </span>
                      </>
                    ) : playerData.aiProgress.tier === 'grandmaster' ? (
                      <>
                        <span>Grandmaster Series</span>
                        <span className="text-white/60 text-[9px] lowercase mt-0.5 font-sans">
                          {playerData.aiProgress.grandmaster.bossSeriesWins} wins | {playerData.aiProgress.grandmaster.bossSeriesLosses} losses (Best of 3)
                        </span>
                      </>
                    ) : (
                      <span>LEVEL: {playerData.aiProgress.level}</span>
                    )}
                  </motion.div>
                )}

                {/* Rewards Indicator */}
                {matchRewards && !isLocalVS && (matchRewards.badge || matchRewards.tierUnlocked || matchRewards.cupCompleted) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                    className="mb-4 flex flex-col items-center justify-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white/80"
                  >
                    {matchRewards.badge && (
                      <div className="text-cyan-400 text-[9px] bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-full animate-pulse mt-1">
                        🏆 Badge: {matchRewards.badge}
                      </div>
                    )}
                    
                    {matchRewards.tierUnlocked && (
                      <div className="text-green-400 text-[9px] bg-green-950/40 border border-green-500/30 px-3 py-1 rounded-full mt-1">
                        ✨ Tier Unlocked: {matchRewards.tierUnlocked.toUpperCase().replace('_', ' ')}
                      </div>
                    )}

                    {matchRewards.cupCompleted && (
                      <div className="text-yellow-400 text-[9px] bg-yellow-950/40 border border-yellow-500/30 px-3 py-1 rounded-full mt-1 font-sans">
                        🏆 Cup {matchRewards.cupCompleted} Cleared!
                      </div>
                    )}

                    {nextCharacter && (
                      <div className="text-[#d9ad33] text-[9px] mt-1 normal-case tracking-normal font-sans">
                        Next Challenge: <span className="underline">{nextCharacter.name}</span> ({nextCharacter.title})
                      </div>
                    )}
                  </motion.div>
                )}
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        playSound('click');
                        console.log('Opening Analysis');
                        setShowReview(true);
                      }}
                      className="play-mode-button h-10 bg-white/5 border border-white/10 text-white font-bold tracking-[0.2em] rounded-xl hover:bg-white/10 transition-all uppercase text-[9px] flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                    >
                      <BarChart2 size={14} />
                      Analysis
                    </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      playSound('click');
                      // Open Analysis and then trigger premium modal
                      setShowReview(true);
                      setTimeout(() => {
                        const event = new CustomEvent('open-premium-modal');
                        window.dispatchEvent(event);
                      }, 100);
                    }}
                    className="play-mode-button h-10 bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#c084fc] font-bold tracking-[0.2em] rounded-xl hover:bg-[#a855f7]/30 transition-all uppercase text-[9px] flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                  >
                    <Crown size={14} />
                    Premium
                  </motion.button>
                </div>

                <div className="flex flex-col gap-2">
                  {(() => {
                    if (isMultiplayer) {
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            playSound('click');
                            navigateWithCleanup('Home');
                          }}
                          className="play-mode-button h-10 bg-[#d9ad33] text-black font-bold tracking-[0.2em] rounded-xl shadow-lg uppercase text-[9px] cursor-pointer pointer-events-auto"
                        >
                          Exit to Court
                        </motion.button>
                      );
                    }

                    const outcome = gameOver
                      ? (gameOver.includes(t.victory)
                        ? 'win'
                        : (chess.isDraw() || gameOver.includes(t.draw) || gameOver.toLowerCase().includes('draw') || gameOver.toLowerCase().includes('stalemate')
                          ? 'draw'
                          : 'loss'))
                      : 'loss';

                    const cta = getGameResultCTA(
                      outcome,
                      activeCharacterId,
                      playerData.aiProgress || { tier: 'beginner', level: 1, elo: 300, consecutiveLosses: 0, unlockedTiers: ['beginner'], lockedTiers: [], promotionTrial: { unlocked: false, completed: false }, hard: { locked: true }, masterCup: { currentCup: 1, currentMatch: 1, winsInCup: 0, lossesInCup: 0, completedCups: [] }, grandmaster: { unlocked: false, bossDefeated: false, bossSeriesWins: 0, bossSeriesLosses: 0, seasonPoints: 0 } }
                    );

                    return (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          playSound('click');
                          if (cta.nextCharacterId) {
                            onNavigate('Game', cta.nextCharacterId);
                          } else if (cta.label === 'BACK TO LEVELS') {
                            navigateWithCleanup('LevelSelect');
                          } else {
                            resetGame();
                          }
                        }}
                        className="play-mode-button h-10 bg-[#d9ad33] text-black font-bold tracking-[0.2em] rounded-xl shadow-lg uppercase text-[9px] cursor-pointer pointer-events-auto flex items-center justify-center"
                      >
                        {cta.label}
                      </motion.button>
                    );
                  })()}
                  {!isMultiplayer && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        playSound('click');
                        navigateWithCleanup('LevelSelect');
                      }}
                      className="play-mode-button h-10 bg-white/5 border border-white/10 text-white/60 font-bold tracking-[0.2em] rounded-xl hover:bg-white/10 transition-all uppercase text-[9px] cursor-pointer pointer-events-auto"
                    >
                      {t.selectLevel}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side Menu Drawer */}
        <AnimatePresence>
          {showDeclareConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-[#d9ad33]/40 text-center shadow-2xl"
              >
                <h3 className="play-popup-title text-xl font-bold text-[#d9ad33] mb-4 font-serif tracking-widest uppercase">
                  {isMultiplayer ? "Offer Draw?" : "Declare Draw?"}
                </h3>
                <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">
                  {isMultiplayer 
                    ? "Are you sure you want to offer a draw to your opponent?" 
                    : "Are you sure you want to declare this game as a draw?"}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      playSound('click');
                      setShowDeclareConfirm(false);
                    }}
                    className="flex-1 play-mode-button rounded-xl border border-white/10 text-white/60 font-bold tracking-widest text-xs uppercase hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      handleDeclareDraw();
                    }}
                    className="flex-1 play-mode-button rounded-xl bg-[#d9ad33] text-black font-bold tracking-widest text-xs uppercase hover:brightness-110 transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showResignConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-[#d9ad33]/40 text-center shadow-2xl"
              >
                <h3 className="play-popup-title text-xl font-bold text-[#d9ad33] mb-4 font-serif tracking-widest uppercase">
                  Resign Match?
                </h3>
                <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">
                  Are you sure you want to resign and forfeit this match?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      playSound('click');
                      setShowResignConfirm(false);
                    }}
                    className="flex-1 play-mode-button rounded-xl border border-white/10 text-white/60 font-bold tracking-widest text-xs uppercase hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      setShowResignConfirm(false);
                      handleResign();
                    }}
                    className="flex-1 play-mode-button rounded-xl bg-red-600 text-white font-bold tracking-widest text-xs uppercase hover:bg-red-700 transition-all border border-red-500/20"
                  >
                    Resign
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {showReview && (
            <GameplayReview
              history={history}
              onClose={() => setShowReview(false)}
              playerData={playerData}
              userName={playerData.name}
              userUid={playerData.uid || 'GUEST-USER'}
              onUpdatePlayerData={onUpdatePlayerData}
              whiteTime={whiteTime}
              blackTime={blackTime}
              whitePlayerName={whitePlayerName}
              blackPlayerName={blackPlayerName}
              isLocalGame={isLocalVS}
              playerColor={playerColor}
            />
          )}
          {isMultiplayer && reconnectTimeLeft !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-red-500/40 text-center shadow-2xl p-6"
              >
                <h3 className="play-popup-title text-xl font-bold text-red-500 mb-4 font-serif tracking-widest uppercase">Opponent Disconnected</h3>
                <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">
                  {reconnectTimeLeft > 0 
                    ? `Waiting for opponent to reconnect... ${reconnectTimeLeft}s` 
                    : `Opponent failed to reconnect.`}
                </p>
                {reconnectTimeLeft === 0 && (
                  <button
                    onClick={async () => {
                      playSound('click');
                      await submitResult(multiplayerConfig!.roomId, {
                        winnerUid: user?.uid,
                        winnerColor: multiplayerConfig!.color,
                        status: 'abandoned',
                        reason: 'disconnect',
                        endedAt: Date.now()
                      });
                    }}
                    className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest text-xs uppercase hover:brightness-110 transition-all rounded-xl"
                  >
                    MARK AS ABANDONED
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}

          {isMultiplayer && drawOfferReceived && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-[#d9ad33]/40 text-center shadow-2xl p-6"
              >
                <h3 className="play-popup-title text-xl font-bold text-[#d9ad33] mb-4 font-serif tracking-widest uppercase">Draw Offered</h3>
                <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">Opponent offered a draw. Accept or Decline?</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeclineDraw}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold tracking-widest text-xs uppercase hover:bg-white/5 transition-all"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleAcceptDraw}
                    className="flex-1 py-3 rounded-xl bg-[#d9ad33] text-black font-bold tracking-widest text-xs uppercase hover:brightness-110 transition-all"
                  >
                    Accept
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isMultiplayer && drawOfferSent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[150] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="play-popup bg-black/60 backdrop-blur-2xl border-2 border-[#d9ad33]/40 text-center shadow-2xl p-6"
              >
                <h3 className="play-popup-title text-xl font-bold text-[#d9ad33] mb-4 font-serif tracking-widest uppercase">Draw Offered</h3>
                <p className="text-white/60 text-xs mb-6 uppercase tracking-wider">Waiting for opponent to accept or decline the draw offer...</p>
                <button
                  onClick={handleDeclineDraw}
                  className="w-full py-3 bg-red-900/10 border border-red-500/20 text-red-400 font-bold tracking-widest rounded-xl text-xs hover:bg-red-900/30 transition-all"
                >
                  CANCEL OFFER
                </button>
              </motion.div>
            </motion.div>
          )}

          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="absolute top-0 left-0 bottom-0 w-[280px] md:w-80 bg-black/60 backdrop-blur-2xl border-r border-white/10 z-50 p-6 md:p-8 flex flex-col shadow-2xl overflow-y-auto custom-scrollbar"
              >
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-3">
                    <Layout size={24} className="text-[#d9ad33]" />
                    <h3 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">{t.menu}</h3>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <MenuButton icon={<X size={16} />} label={t.resume} onClick={() => setIsMenuOpen(false)} />
                  <MenuButton icon={<RotateCcw size={16} />} label={isMultiplayer ? "OFFER DRAW" : "DECLARE DRAW"} onClick={() => { setIsMenuOpen(false); setShowDeclareConfirm(true); }} />
                  {isMultiplayer && (
                    <MenuButton icon={<X size={16} />} label="RESIGN MATCH" onClick={() => { setIsMenuOpen(false); setShowResignConfirm(true); }} />
                  )}
                  <MenuButton icon={<Home size={16} />} label={t.exitToHome} onClick={() => navigateWithCleanup('Home')} />
                  {!isMultiplayer && (
                    <MenuButton icon={<RotateCcw size={16} />} label={t.newGame} onClick={() => { resetGame(); setIsMenuOpen(false); }} />
                  )}
                  <MenuButton icon={<BarChart2 size={16} />} label={t.myStats} onClick={() => navigateWithCleanup('Stats')} />
                </div>

                <div className="mt-auto pt-8 border-t border-white/5">
                  <p className="text-[#52452a] text-[9px] font-bold tracking-[0.3em] text-center uppercase">Clash of Crowns v1.0</p>
                </div>
              </motion.div>
            </>
          )}
          <AvatarCommentaryBubble
            reaction={activeCommentary}
            onClose={() => setActiveCommentary(null)}
            characterName={isMultiplayer ? 'Commentator' : (aiCharacter?.name || 'Opponent')}
          />
          {show3DTimeoutPrompt && playerData.viewMode === '3d' && !is3DLoaded && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-[140px] left-1/2 -translate-x-1/2 z-[110] bg-[#0c0a0e]/95 backdrop-blur-md border border-[#d9ad33]/40 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-[0_10px_35px_rgba(0,0,0,0.8)] pointer-events-auto"
            >
              <span className="text-xs text-white/80 font-sans font-medium">
                3D board is still loading. Switch to 2D?
              </span>
              <button
                onClick={() => {
                  playSound('click');
                  onUpdatePlayerData({ viewMode: '2d' });
                  setShow3DTimeoutPrompt(false);
                }}
                className="px-3 py-1.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black font-sans font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Switch to 2D
              </button>
              <button
                onClick={() => setShow3DTimeoutPrompt(false)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer text-xs font-bold"
              >
                Dismiss
              </button>
            </motion.div>
          )}
          {showUndoPackModal && (
            <div className="absolute inset-0 z-[160] flex items-center justify-center p-6 pointer-events-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  playSound('click');
                  setShowUndoPackModal(false);
                }}
                className="absolute inset-0 bg-black/85 backdrop-blur-sm pointer-events-auto"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-[#131118]/95 backdrop-blur-xl border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl text-center flex flex-col items-center gap-6 pointer-events-auto"
              >
                {/* Close (Cross) Icon Button */}
                <button
                  onClick={() => {
                    playSound('click');
                    setShowUndoPackModal(false);
                  }}
                  className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/5 pointer-events-auto z-50"
                  title="Close"
                >
                  <X size={16} />
                </button>

                <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 font-serif uppercase tracking-wider">Undo Pack Required</h3>
                  <p className="text-gray-400 text-xs leading-relaxed font-sans font-medium">
                    You have run out of Undo Tokens. You can buy Undo Packs or purchase Premium to enable unlimited undos!
                  </p>
                </div>
                <div className="flex flex-col w-full gap-2 font-sans">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      playSound('click');
                      setShowUndoPackModal(false);
                      navigateWithCleanup('Premium');
                    }}
                    className="w-full py-3 bg-[#d9ad33] hover:bg-[#f5d666] text-black rounded-xl font-bold tracking-widest uppercase text-[10px] transition-colors shadow-lg cursor-pointer pointer-events-auto"
                  >
                    Go to Shop
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={() => {
        playSound('click');
        onClick();
      }}
      className="flex items-center gap-4 h-10 md:h-12 px-4 bg-white/5 border-l-4 border-[#d9ad33] text-white hover:bg-white/10 transition-all font-bold tracking-widest text-xs cursor-pointer pointer-events-auto"
    >
      <span className="text-[#d9ad33]">{icon}</span>
      {label}
    </button>
  );
}

