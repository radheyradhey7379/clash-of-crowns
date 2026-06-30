/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, X, Play, Pause, Save, CheckCircle2, 
  FastForward, Crown, Lock, Download, BarChart2, Shield, Zap, 
  Video, Activity, Target, Info, Trash2, Plus, Loader2, AlertCircle,
  ZoomIn, ZoomOut
} from 'lucide-react';
import { cn, downloadElement } from '../../lib/utils';
import { ChessLogic } from '../../lib/chess-logic';
import ChessBoard2D from './ChessBoard2D';
import { PlayerData } from '../../types';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import RecordRTC from 'recordrtc';
import { domToCanvas } from 'modern-screenshot';
import { useTranslation } from '../../lib/translations';
import { playSound } from '../../lib/sounds';
import { encryptObject } from '../../lib/encryption';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';
import { getApiUrl } from '../../services/apiClient';
import { PRICING_CONFIG } from '../../config/pricing';

interface HistoryItem {
  fen: string;
  move: string;
  evaluation: number;
  comment?: string;
  moveNumber?: number;
  side?: string;
  classification?: 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
}

interface GameplayReviewProps {
  history: HistoryItem[];
  onClose: () => void;
  playerData: PlayerData;
  userName: string;
  userUid: string;
  onUpdatePlayerData: (newData: Partial<PlayerData>) => void;
  whiteTime?: number;
  blackTime?: number;
  whitePlayerName?: string;
  blackPlayerName?: string;
  isLocalGame?: boolean;
  playerColor?: 'w' | 'b';
}

export default function GameplayReview({ 
  history, 
  onClose, 
  playerData, 
  userName, 
  userUid,
  onUpdatePlayerData,
  whiteTime = 0,
  blackTime = 0,
  whitePlayerName,
  blackPlayerName,
  isLocalGame = false,
  playerColor = 'w'
}: GameplayReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [chess] = useState(() => new ChessLogic());
  const [board, setBoard] = useState(chess.getBoard());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(10);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeEval, setIncludeEval] = useState(true);
  const [boardSize, setBoardSize] = useState(480);
  const [isManualSize, setIsManualSize] = useState(false);
  const [minimizedWidgets, setMinimizedWidgets] = useState<string[]>([]);
  const [includeUndo, setIncludeUndo] = useState(false);
  const [selectedUndoPlan, setSelectedUndoPlan] = useState<'day' | 'month' | 'year'>('month');

  const { width, height, isMobile } = useDeviceLayout();
  const isMobileLayout = isMobile || width < 1024 || height < 650;
  const [activeTab, setActiveTab] = useState<'board' | 'moves' | 'analysis'>('board');
  
  const moveListRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const deleteTimerRef = useRef<any>(null);

  const isPremium = playerData.isPremium;
  const isAuthReady = !!auth.currentUser;

  useEffect(() => {
    if (isManualSize) return;
    const updateSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      if (isMobileLayout) {
        if (w > h) {
          // Landscape: constrained by height
          const maxH = h - 52 - 48 - 52 - 34 - 20;
          setBoardSize(Math.max(160, Math.floor(maxH / 8) * 8));
        } else {
          // Portrait: constrained by width
          const maxW = w - 40;
          setBoardSize(Math.max(200, Math.floor(maxW / 8) * 8));
        }
      } else {
        // Desktop
        setBoardSize(480);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isManualSize, isMobileLayout]);

  useEffect(() => {
    const handleOpenPremium = () => setShowPremiumModal(true);
    window.addEventListener('open-premium-modal', handleOpenPremium);
    return () => window.removeEventListener('open-premium-modal', handleOpenPremium);
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      const item = history[currentIndex];
      const tempChess = new ChessLogic(item.fen);
      setBoard(tempChess.getBoard());

      // Calculate last move for highlighting
      if (currentIndex > 0) {
        const prevItem = history[currentIndex - 1];
        const prevChess = new ChessLogic(prevItem.fen);
        const moveResult = prevChess.makeMove(item.move);
        if (moveResult) {
          setLastMove({ from: moveResult.from, to: moveResult.to });
        } else {
          setLastMove(null);
        }
      } else {
        setLastMove(null);
      }
      
      if (moveListRef.current) {
        const activeMove = moveListRef.current.querySelector(`[data-index="${currentIndex}"]`);
        if (activeMove) {
          activeMove.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentIndex, history]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && currentIndex < history.length - 1) {
      timer = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 1000 / playbackSpeed);
    } else if (currentIndex === history.length - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, history, playbackSpeed]);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      // Encrypt history for security
      const encryptedHistory = encryptObject(history.map(h => ({
        fen: h.fen,
        move: h.move,
        evaluation: h.evaluation,
        comment: h.comment,
        moveNumber: h.moveNumber,
        side: h.side,
        classification: h.classification
      })), auth.currentUser.uid);

      const sessionData = {
        uid: auth.currentUser.uid,
        userName: userName,
        timestamp: serverTimestamp(),
        history: encryptedHistory, // Store encrypted history
        opponentName: "Opponent", 
        opponentRating: 1450,
        isEncrypted: true
      };
      
      const docRef = await addDoc(collection(db, 'gameplaySessions'), sessionData);
      setSavedSessionId(docRef.id);
      setIsSaving(false);
      setShowSavedPopup(true);
      setTimeout(() => setShowSavedPopup(false), 3000);
    } catch (error) {
      setIsSaving(false);
      handleFirestoreError(error, OperationType.CREATE, 'gameplaySessions');
    }
  };

  const triggerDelete = () => {
    setDeleteCountdown(10);
    setShowDeleteConfirm(true);
    deleteTimerRef.current = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          clearInterval(deleteTimerRef.current);
          handleFinalDelete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleFinalDelete = async () => {
    if (savedSessionId) {
      setIsDeleting(true);
      try {
        await deleteDoc(doc(db, 'gameplaySessions', savedSessionId));
        setSavedSessionId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `gameplaySessions/${savedSessionId}`);
      } finally {
        setIsDeleting(false);
      }
    }
    onClose();
  };

  const handleDownloadVideo = async () => {
    if (!reviewRef.current) return;
    gated(async () => {
      setIsRecording(true);
      setRecordingProgress(0);
      
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        // Set dimensions based on quality
        const width = videoQuality === '1080p' ? 1920 : 1280;
        const height = videoQuality === '1080p' ? 1080 : 720;
        canvas.width = width;
        canvas.height = height;

        const recorder = new RecordRTC.CanvasRecorder(canvas as any, {
          type: 'canvas',
          frameInterval: 100,
        } as any);

        (recorder as any).startRecording();

        // Record the current state for a few seconds
        // In a real app, we might want to iterate through moves
        const frames = 30;
        for (let i = 0; i < frames; i++) {
          const elementCanvas = await domToCanvas(reviewRef.current, {
            scale: width / reviewRef.current.offsetWidth,
          });
          context.clearRect(0, 0, width, height);
          context.drawImage(elementCanvas, 0, 0, width, height);
          setRecordingProgress(Math.round(((i + 1) / frames) * 100));
          await new Promise(r => setTimeout(r, 100));
        }

        (recorder as any).stopRecording(() => {
          const blob = (recorder as any).getBlob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chess-replay-${Date.now()}.mp4`;
          a.click();
          setIsRecording(false);
          setShowSavedPopup(true); // Reuse saved popup for success message
        });
      } catch (error) {
        console.error("Recording error:", error);
        setIsRecording(false);
      }
    });
  };

  const handleUpgrade = async (type: 'premium' | 'undo_day' | 'undo_month' | 'undo_year') => {
    try {
      const prices = {
        premium: includeUndo 
          ? (PRICING_CONFIG.PREMIUM_MONTHLY + PRICING_CONFIG.UNDO_ADDON_MONTHLY) 
          : PRICING_CONFIG.PREMIUM_MONTHLY,
        undo_day: PRICING_CONFIG.UNDO_PASS_DAILY,
        undo_month: PRICING_CONFIG.UNDO_PASS_MONTHLY,
        undo_year: PRICING_CONFIG.UNDO_PASS_YEARLY
      };
      
      const labels = {
        premium: `Premium Bundle ${includeUndo ? '(with Undo)' : ''}`,
        undo_day: 'Daily Undo Pass',
        undo_month: 'Monthly Undo Pass',
        undo_year: 'Yearly Undo Pass'
      };

      alert(`Redirecting to secure payment gateway for ₹${prices[type]} ${labels[type]}...`);
      
      // Real Stripe logic would go here
      /*
      const response = await fetch(getApiUrl("/api/create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          userEmail: auth.currentUser?.email,
          type,
          includeUndo
        }),
      });
      const session = await response.json();
      const stripe = await loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || "");
      if (stripe) {
        await (stripe as any).redirectToCheckout({ sessionId: session.id });
      }
      */
    } catch (error) {
      console.error("Upgrade error:", error);
    }
  };

  const cancelDelete = () => {
    if (deleteTimerRef.current) clearInterval(deleteTimerRef.current);
    setShowDeleteConfirm(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentItem = history[currentIndex];
  
  const gated = (fn: () => void) => {
    if (!isPremium) {
      setShowPremiumModal(true);
      return;
    }
    fn();
  };

  return (
    <div ref={reviewRef} className="fixed inset-0 z-[200] bg-[#09090b] flex flex-col pointer-events-auto overflow-hidden font-body">
      {/* Navbar */}
      <nav className="h-[52px] flex-shrink-0 bg-[#060608] border-b border-[#252528] flex items-center px-3 gap-2 z-50">
        <button 
          onClick={() => {
            playSound('click');
            onClose();
          }}
          className="px-4 py-2 rounded-lg bg-[#1a1a1e] border border-[#252528] text-[#f5c518] text-[12px] md:text-[13px] font-serif font-bold tracking-wider hover:bg-[#252528] transition-all uppercase flex items-center gap-2 shadow-lg"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        <button 
          onClick={() => {
            playSound('click');
            handleSave();
          }}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] text-[12px] md:text-[13px] font-serif font-bold tracking-wider hover:brightness-110 transition-all uppercase flex items-center gap-2 disabled:opacity-50 shadow-lg"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : '⬡'}
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        
        <div className="flex-1 text-center overflow-hidden px-2">
          <div className="font-serif text-[12px] md:text-[14px] text-[#f5c518] tracking-[0.4em] whitespace-nowrap uppercase">Clash of Crowns</div>
          <div className="text-[10px] md:text-[11px] text-[#524e48] tracking-[0.2em] mt-0.5 whitespace-nowrap uppercase">Session Analysis · {userName}</div>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] md:text-[11px] font-serif tracking-wider whitespace-nowrap transition-all shadow-lg",
          isPremium 
            ? "border-[#a855f7] text-[#c084fc] bg-[#1a0d2e] shadow-[0_0_15px_rgba(168,85,247,0.3)]" 
            : "border-white/10 text-white/40 bg-white/5"
        )}>
          <span>{isPremium ? "👑" : "👤"}</span>
          <span>{isPremium ? "PREMIUM" : "FREE MEMBER"}</span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-row lg:grid lg:grid-cols-[280px_1fr_320px] overflow-x-auto lg:overflow-hidden min-h-0 custom-scrollbar">
        
        {/* Left Panel: Move History */}
        {(!isMobileLayout || activeTab === 'moves') && (
          <div 
            className="w-full lg:w-auto flex-shrink-0 bg-[#111114] lg:border-r border-[#252528] flex flex-col overflow-hidden lg:w-[260px]"
          >
            <div className="p-3 border-b border-[#252528] flex items-center justify-between flex-shrink-0">
              <h3 className="font-serif text-[9px] text-[#f5c518] tracking-[0.4em] uppercase">Move History</h3>
              <span className="bg-[#222228] text-[#f5c518] rounded-full px-2 py-0.5 text-[11px] font-mono border border-[#323238]">{history.length}</span>
            </div>
            <div 
              ref={moveListRef} 
              className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar"
            >
              {history.map((item, idx) => (
                <button
                  key={idx}
                  data-index={idx}
                  onClick={() => {
                    playSound('click');
                    setCurrentIndex(idx);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-md transition-all text-left group border border-transparent",
                    currentIndex === idx 
                      ? "bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] shadow-lg" 
                      : "bg-[#18181c] hover:bg-[#222228] hover:border-[#323238] text-[#e2ddd4]"
                  )}
                >
                  <span className={cn("text-[10px] font-mono min-w-[24px]", currentIndex === idx ? "text-[#120900]" : "text-[#524e48]")}>
                    {Math.floor(idx / 2) + 1}{idx % 2 === 0 ? '.' : '…'}
                  </span>
                  <span className="font-serif font-bold text-[14px] flex-1 tracking-wide">{item.move}</span>
                  {item.classification && (
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded font-serif font-bold uppercase tracking-wider",
                      item.classification === 'brilliant' && "bg-[#001a20] text-[#00cfef]",
                      item.classification === 'best' && "bg-[#0d1e0d] text-[#4ec97a]",
                      item.classification === 'good' && "bg-[#111a08] text-[#90c840]",
                      item.classification === 'inaccuracy' && "bg-[#1e1a00] text-[#ffd040]",
                      item.classification === 'mistake' && "bg-[#1e1000] text-[#f09820]",
                      item.classification === 'blunder' && "bg-[#200808] text-[#e05252]"
                    )}>
                      {item.classification}
                    </span>
                  )}
                </button>
              ))}
              
              {!isPremium && history.length > 4 && (
                <div 
                  onClick={() => {
                    playSound('click');
                    setShowPremiumModal(true);
                  }}
                  className="mt-2 p-3 bg-gradient-to-br from-[#1a0d2e] to-[#0d0620] border border-[#4a1d96] rounded-lg text-center cursor-pointer hover:brightness-110 transition-all"
                >
                  <div className="text-[20px] mb-1">🔒</div>
                  <div className="font-serif text-[10px] text-[#a855f7] tracking-widest mb-1 uppercase">Premium Required</div>
                  <div className="text-[10px] text-[#666] leading-relaxed mb-2">Unlock full move history and AI analysis.</div>
                  <button className="px-4 py-1.5 rounded-md bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white text-[10px] font-serif font-bold tracking-wider">Unlock All</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center Panel: Board & Playback */}
        {(!isMobileLayout || activeTab === 'board') && (
          <div 
            className="w-full flex-grow lg:flex-1 flex flex-col items-center p-3 md:p-6 gap-3 overflow-y-auto bg-[#09090b] custom-scrollbar"
          >
            {/* Opponent Bar */}
            {width < 600 ? (
              <div className="w-full max-w-[520px] flex items-center justify-between px-2 text-[11px] text-[#e2ddd4]">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-[#8a857c]">⚫</span>
                  <span>{blackPlayerName || 'Opponent'}</span>
                </div>
                <div className="font-mono text-[#8a857c]">Time: {formatTime(blackTime)}</div>
              </div>
            ) : (
              <div className="w-full max-w-[520px] flex items-center p-2.5 gap-2.5 bg-[#111114] rounded-lg border border-[#252528]">
                <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border-2 border-[#444] flex items-center justify-center text-[18px]">♟</div>
                <div className="flex-1">
                  <div className="text-[12px] font-serif font-bold text-[#e2ddd4]">{blackPlayerName || 'Opponent'}</div>
                  <div className="text-[10px] text-[#524e48] mt-0.5 uppercase tracking-tighter">Time Taken · Black</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mb-0.5">Total Time</div>
                  <div className="font-mono text-[13px] px-2.5 py-1 bg-[#080808] rounded border border-[#323238] text-[#8a857c]">{formatTime(blackTime)}</div>
                </div>
              </div>
            )}

          {/* Board */}
          <div className="flex items-center relative">
            <div className="absolute -right-12 top-0 flex flex-col gap-2 z-20">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  playSound('click');
                  setIsManualSize(true);
                  setBoardSize(prev => Math.min(640, prev + 40));
                }}
                className="w-10 h-10 rounded-xl bg-[#111114] border border-[#d9ad33]/30 text-[#d9ad33] flex items-center justify-center shadow-lg hover:bg-[#1a1a1e] transition-all"
                title="Maximize Board"
              >
                <ZoomIn size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  playSound('click');
                  setIsManualSize(true);
                  setBoardSize(prev => Math.max(240, prev - 40));
                }}
                className="w-10 h-10 rounded-xl bg-[#111114] border border-[#d9ad33]/30 text-[#d9ad33] flex items-center justify-center shadow-lg hover:bg-[#1a1a1e] transition-all"
                title="Minimize Board"
              >
                <ZoomOut size={20} />
              </motion.button>
              {isManualSize && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => {
                    playSound('click');
                    setIsManualSize(false);
                  }}
                  className="w-10 h-10 rounded-xl bg-red-900/20 border border-red-500/30 text-red-500 flex items-center justify-center shadow-lg hover:bg-red-900/40 transition-all"
                  title="Reset Auto Size"
                >
                  <X size={16} />
                </motion.button>
              )}
            </div>

            <div 
              className="flex flex-col justify-around pr-1.5 text-[10px] text-[#524e48] font-mono"
              style={{ height: boardSize }}
            >
              {(playerColor === 'w' ? ['8','7','6','5','4','3','2','1'] : ['1','2','3','4','5','6','7','8']).map(r => <span key={r}>{r}</span>)}
            </div>
            <div>
              <div className="rounded-sm overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,0.75),0_0_0_1px_#252528]">
                <div style={{ width: boardSize, height: boardSize }}>
                  <ChessBoard2D
                    board={board}
                    selectedSquare={null}
                    validMoves={[]}
                    lastMove={lastMove}
                    onSquareClick={() => {}}
                    playerColor={playerColor}
                    checkInfo={null}
                  />
                </div>
              </div>
              <div 
                className="flex justify-around pt-1 text-[10px] text-[#524e48] font-mono"
                style={{ width: boardSize }}
              >
                {(playerColor === 'w' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a']).map(f => <span key={f}>{f}</span>)}
              </div>
            </div>
          </div>

            {/* Player Bar */}
            {width < 600 ? (
              <div className="w-full max-w-[520px] flex items-center justify-between px-2 text-[11px] text-[#e2ddd4] mt-1">
                <div className="flex items-center gap-1.5 font-bold text-[#f5c518]">
                  <span>⚪</span>
                  <span>{whitePlayerName || userName}</span>
                </div>
                <div className="font-mono text-[#f5c518] font-bold">Time: {formatTime(whiteTime)}</div>
              </div>
            ) : (
              <div className="w-full max-w-[520px] flex items-center p-2.5 gap-2.5 bg-[#111114] rounded-lg border border-[#252528]">
                <div className="w-8 h-8 rounded-full bg-[#1c1c1c] border-2 border-[#f5c518] flex items-center justify-center text-[18px]">♔</div>
                <div className="flex-1">
                  <div className="text-[12px] font-serif font-bold text-[#e2ddd4]">{whitePlayerName || userName}</div>
                  <div className="text-[10px] text-[#524e48] mt-0.5 uppercase tracking-tighter">Time Taken · White</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[8px] text-[#8c7a52] font-bold tracking-widest uppercase mb-0.5">Total Time</div>
                  <div className="font-mono text-[13px] px-2.5 py-1 bg-[#080808] rounded border border-[rgba(245,197,24,0.4)] text-[#f5c518] shadow-[0_0_10px_rgba(245,197,24,0.18)]">{formatTime(whiteTime)}</div>
                </div>
              </div>
            )}

          {/* Playback Controls */}
          <div className="w-full max-w-[520px] bg-[#111114] rounded-lg border border-[#252528] p-3 relative">
            <div className="flex items-center gap-2">
              <button onClick={() => gated(() => { playSound('click'); setCurrentIndex(0); })} className="w-8 h-8 rounded-md border border-[#323238] bg-[#18181c] text-[#8a857c] flex items-center justify-center hover:bg-[#222228] transition-all"><FastForward size={14} className="rotate-180" /></button>
              <button onClick={() => gated(() => { playSound('click'); setCurrentIndex(Math.max(0, currentIndex - 1)); })} className="w-8 h-8 rounded-md border border-[#323238] bg-[#18181c] text-[#8a857c] flex items-center justify-center hover:bg-[#222228] transition-all"><ChevronLeft size={16} /></button>
              <button 
                onClick={() => gated(() => { playSound('click'); setIsPlaying(!isPlaying); })}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] flex items-center justify-center shadow-[0_0_20px_rgba(245,197,24,0.18)] hover:scale-105 transition-all"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <button onClick={() => gated(() => { playSound('click'); setCurrentIndex(Math.min(history.length - 1, currentIndex + 1)); })} className="w-8 h-8 rounded-md border border-[#323238] bg-[#18181c] text-[#8a857c] flex items-center justify-center hover:bg-[#222228] transition-all"><ChevronRight size={16} /></button>
              <button onClick={() => gated(() => { playSound('click'); setCurrentIndex(history.length - 1); })} className="w-8 h-8 rounded-md border border-[#323238] bg-[#18181c] text-[#8a857c] flex items-center justify-center hover:bg-[#222228] transition-all"><FastForward size={14} /></button>
              
              <div className="flex-1 flex flex-col gap-1">
                <div className="h-1.5 bg-[#1a1a1a] rounded-full relative cursor-pointer overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#f5c518] to-[#c9970e] transition-all duration-300"
                    style={{ width: `${(currentIndex / Math.max(history.length - 1, 1)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-[#524e48] font-mono uppercase">
                  <span>Move {currentIndex}</span>
                  <span>Total {history.length}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[9px] text-[#524e48] font-serif tracking-widest uppercase mr-1">Speed</span>
              {[0.5, 1, 1.5, 2].map(s => (
                <button
                  key={s}
                  onClick={() => gated(() => { playSound('click'); setPlaybackSpeed(s); })}
                  className={cn(
                    "px-2 py-0.5 rounded border text-[10px] font-mono transition-all",
                    playbackSpeed === s ? "bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] border-transparent font-bold" : "bg-[#18181c] border-[#323238] text-[#524e48]"
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>

            {!isPremium && (
              <div 
                onClick={() => setShowPremiumModal(true)}
                className="absolute inset-0 bg-[#09090b]/85 backdrop-blur-[4px] rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer z-10"
              >
                <Lock size={24} className="text-[#f5c518]" />
                <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase">Premium Feature</span>
                <span className="text-[10px] text-[#888]">Tap to unlock playback controls</span>
              </div>
            )}
          </div>
          </div>
        )}

        {/* Right Panel: Analysis Widgets */}
        {(!isMobileLayout || activeTab === 'analysis') && (
          <div className="w-full lg:w-[320px] flex-shrink-0 bg-[#111114] lg:border-l border-[#252528] flex flex-col overflow-y-auto custom-scrollbar">
          
          {/* AI Analysis */}
          <div className="p-3 border-b border-[#252528]">
            <div 
              className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase flex items-center justify-between cursor-pointer group"
              onClick={() => setMinimizedWidgets(prev => prev.includes('ai') ? prev.filter(w => w !== 'ai') : [...prev, 'ai'])}
            >
              <span>AI Grandmaster Analysis</span>
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-[#d9ad33] opacity-0 group-hover:opacity-100 transition-opacity">{minimizedWidgets.includes('ai') ? 'MAXIMIZE' : 'MINIMIZE'}</span>
                {minimizedWidgets.includes('ai') ? <Plus size={10} /> : <X size={10} className="rotate-45" />}
              </div>
            </div>
            {!minimizedWidgets.includes('ai') && (
              <div className="relative overflow-hidden rounded-lg">
                <div className={cn("bg-[#0e0b00] border border-[#2a1e00] p-3 transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                  <div className="flex items-center gap-2 mb-2">
                    <Crown size={18} className="text-[#f5c518]" />
                    <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase">Grandmaster</span>
                    {currentItem?.classification && (
                      <span className={cn(
                        "ml-auto px-2 py-0.5 rounded-full text-[8px] font-serif font-bold tracking-widest uppercase",
                        currentItem.classification === 'brilliant' && "bg-[#001a20] text-[#00cfef]",
                        currentItem.classification === 'best' && "bg-[#0d1e0d] text-[#4ec97a]",
                        currentItem.classification === 'good' && "bg-[#111a08] text-[#90c840]",
                        currentItem.classification === 'inaccuracy' && "bg-[#1e1a00] text-[#ffd040]",
                        currentItem.classification === 'mistake' && "bg-[#1e1000] text-[#f09820]",
                        currentItem.classification === 'blunder' && "bg-[#200808] text-[#e05252]"
                      )}>
                        {currentItem.classification}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#ccc] leading-relaxed italic">
                    {currentItem?.comment || "Select a move to see the Grandmaster's analysis."}
                  </p>
                </div>
                {!isPremium && (
                  <div 
                    onClick={() => {
                      playSound('click');
                      setShowPremiumModal(true);
                    }} 
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-black/40 backdrop-blur-[2px] border border-[#d9ad33]/20 rounded-lg group"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1a1608] border border-[#d9ad33]/30 flex items-center justify-center text-[#d9ad33] shadow-lg group-hover:scale-110 transition-transform">
                      <Lock size={18} />
                    </div>
                    <span className="font-serif text-[10px] text-[#f5c518] tracking-[0.2em] uppercase font-bold">Premium Feature</span>
                    <div className="px-3 py-1 bg-[#d9ad33] text-black text-[8px] font-bold rounded-full shadow-lg">UPGRADE</div>
                  </div>
                )}
              </div>
            )}
            {!isPremium && !minimizedWidgets.includes('ai') && <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded bg-gradient-to-r from-[#2e0d0d] to-[#200606] border border-[#961d1d] text-[9px] font-serif text-red-400 tracking-wider">⭐ Upgrade for AI insights</div>}
          </div>

          {/* Position Evaluation */}
          <div className="p-3 border-b border-[#252528]">
            <div 
              className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase flex items-center justify-between cursor-pointer group"
              onClick={() => setMinimizedWidgets(prev => prev.includes('eval') ? prev.filter(w => w !== 'eval') : [...prev, 'eval'])}
            >
              <span>Position Evaluation</span>
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-[#d9ad33] opacity-0 group-hover:opacity-100 transition-opacity">{minimizedWidgets.includes('eval') ? 'MAXIMIZE' : 'MINIMIZE'}</span>
                {minimizedWidgets.includes('eval') ? <Plus size={10} /> : <X size={10} className="rotate-45" />}
              </div>
            </div>
            {!minimizedWidgets.includes('eval') && (
              <div className="relative overflow-hidden rounded-lg">
                <div className={cn("transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#524e48] font-serif uppercase">B</span>
                    <div className="flex-1 h-[18px] rounded bg-[#181818] border border-[#323238] overflow-hidden flex">
                      <div 
                        className="bg-[#e8e8e8] transition-all duration-500" 
                        style={{ width: `${Math.max(10, Math.min(90, 50 + (currentItem?.evaluation || 0) * 10))}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[#524e48] font-serif uppercase">W</span>
                    <div className="font-mono text-[12px] text-[#8a857c] min-w-[40px] text-right">
                      {(currentItem?.evaluation || 0) > 0 ? '+' : ''}{currentItem?.evaluation?.toFixed(1) || '0.0'}
                    </div>
                  </div>
                  <div className="mt-1 text-center text-[10px] text-[#524e48]">
                    {(currentItem?.evaluation || 0) > 2 ? 'White winning' : (currentItem?.evaluation || 0) > 0.6 ? 'White better' : (currentItem?.evaluation || 0) < -0.6 ? 'Black better' : 'Equal position'}
                  </div>
                </div>
                {!isPremium && (
                  <div 
                    onClick={() => {
                      playSound('click');
                      setShowPremiumModal(true);
                    }} 
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/40 backdrop-blur-[1px] rounded-lg group"
                  >
                    <Lock size={16} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                    <span className="font-serif text-[9px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Game Statistics */}
          <div className="p-3 border-b border-[#252528]">
            <div className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase">Game Statistics</div>
            <div className="relative overflow-hidden rounded-lg">
              <div className={cn("grid grid-cols-2 gap-1.5 transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                <div className="bg-[#18181c] border border-[#252528] p-2.5 rounded-md text-center">
                  <div className="text-[24px] font-serif font-bold text-[#00cfef]">3</div>
                  <div className="text-[8px] text-[#524e48] tracking-widest uppercase font-serif">Brilliant</div>
                </div>
                <div className="bg-[#18181c] border border-[#252528] p-2.5 rounded-md text-center">
                  <div className="text-[24px] font-serif font-bold text-[#4ec97a]">11</div>
                  <div className="text-[8px] text-[#524e48] tracking-widest uppercase font-serif">Best</div>
                </div>
                <div className="bg-[#18181c] border border-[#252528] p-2.5 rounded-md text-center">
                  <div className="text-[24px] font-serif font-bold text-[#f09820]">2</div>
                  <div className="text-[8px] text-[#524e48] tracking-widest uppercase font-serif">Mistakes</div>
                </div>
                <div className="bg-[#18181c] border border-[#252528] p-2.5 rounded-md text-center">
                  <div className="text-[24px] font-serif font-bold text-[#e05252]">1</div>
                  <div className="text-[8px] text-[#524e48] tracking-widest uppercase font-serif">Blunders</div>
                </div>
              </div>
              {!isPremium && (
                <div 
                  onClick={() => {
                    playSound('click');
                    setShowPremiumModal(true);
                  }} 
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/20 backdrop-blur-[1px] rounded-lg group"
                >
                  <Lock size={18} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                  <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Accuracy */}
          <div className="p-3 border-b border-[#252528]">
            <div className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase">Accuracy & ACPL</div>
            <div className="relative overflow-hidden rounded-lg">
              <div className={cn("flex items-center gap-3 transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                <div className="relative w-[68px] h-[68px] flex-shrink-0">
                  <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
                    <circle cx="34" cy="34" r="26" fill="none" stroke="#1e1e1e" strokeWidth="7"/>
                    <circle 
                      cx="34" cy="34" r="26" fill="none" stroke="#f5c518" strokeWidth="7"
                      strokeDasharray="163" strokeDashoffset="41" strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[13px] font-bold text-[#f5c518]">75%</div>
                </div>
                <div>
                  <div className="font-serif text-[21px] font-bold text-[#f5c518]">75%</div>
                  <div className="text-[10px] text-[#524e48]">Your accuracy</div>
                  <div className="text-[10px] text-[#524e48] mt-1 font-mono">ACPL: <span className="text-[#8a857c]">28</span></div>
                </div>
              </div>
              {!isPremium && (
                <div 
                  onClick={() => {
                    playSound('click');
                    setShowPremiumModal(true);
                  }} 
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/20 backdrop-blur-[1px] rounded-lg group"
                >
                  <Lock size={18} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                  <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Opening Detected */}
          <div className="p-3 border-b border-[#252528]">
            <div className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase flex items-center gap-1.5">
              Opening Detected
              <span className="text-[#4ec97a] text-[8px] font-bold">✓ FREE</span>
            </div>
            <div className="bg-[#08101a] border border-[#102030] rounded-lg p-2.5">
              <div className="font-serif text-[9px] text-[#5080b0] tracking-widest uppercase">C51</div>
              <div className="font-serif text-[13px] text-[#80a8e0] font-bold mt-0.5">Evans Gambit</div>
              <div className="text-[10px] text-[#524e48] mt-1 line-relaxed">White sacrifices b4 pawn for rapid development and central control.</div>
            </div>
          </div>

          {/* King Safety */}
          <div className="p-3 border-b border-[#252528]">
            <div className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase">King Safety Meter</div>
            <div className="relative overflow-hidden rounded-lg">
              <div className={cn("flex flex-col gap-2.5 transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                <div className="flex-1">
                  <div className="text-[9px] text-[#524e48] font-serif tracking-widest uppercase mb-1">White</div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-[#4ec97a] rounded-full" style={{ width: '72%' }} />
                  </div>
                  <div className="text-[10px] font-mono text-[#4ec97a]">72% Safe</div>
                </div>
                <div className="flex-1">
                  <div className="text-[9px] text-[#524e48] font-serif tracking-widest uppercase mb-1">Black</div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-[#f09820] rounded-full" style={{ width: '44%' }} />
                  </div>
                  <div className="text-[10px] font-mono text-[#f09820]">44% Exposed</div>
                </div>
              </div>
              {!isPremium && (
                <div 
                  onClick={() => {
                    playSound('click');
                    setShowPremiumModal(true);
                  }} 
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/20 backdrop-blur-[1px] rounded-lg group"
                >
                  <Lock size={18} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                  <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Piece Activity Heatmap */}
          <div className="p-3 border-b border-[#252528]">
            <div className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase">Piece Activity Heatmap</div>
            <div className="relative overflow-hidden rounded-lg">
              <div className={cn("grid grid-cols-8 gap-0.5 transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                {Array.from({ length: 64 }).map((_, i) => {
                  const r = Math.floor(i / 8);
                  const c = i % 8;
                  const intensity = Math.random(); // Mock intensity
                  const isLight = (r + c) % 2 === 0;
                  return (
                    <div 
                      key={i} 
                      className="aspect-square rounded-[2px]" 
                      style={{ 
                        background: intensity > 0.4 
                          ? `rgba(${Math.round(intensity * 220 + 30)}, ${Math.round((1 - intensity) * (isLight ? 120 : 60))}, 0, ${0.25 + intensity * 0.75})` 
                          : (isLight ? '#2a2a2a' : '#1a1a1a') 
                      }} 
                    />
                  );
                })}
              </div>
              {!isPremium && (
                <div 
                  onClick={() => {
                    playSound('click');
                    setShowPremiumModal(true);
                  }} 
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/20 backdrop-blur-[1px] rounded-lg group"
                >
                  <Lock size={18} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                  <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Video Export */}
          <div className="p-3 border-b border-[#252528]">
            <div 
              className="font-serif text-[8px] text-[#524e48] tracking-[0.4em] mb-2 uppercase flex items-center justify-between cursor-pointer group"
              onClick={() => setMinimizedWidgets(prev => prev.includes('video') ? prev.filter(w => w !== 'video') : [...prev, 'video'])}
            >
              <span>Video Replay Export</span>
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-[#d9ad33] opacity-0 group-hover:opacity-100 transition-opacity">{minimizedWidgets.includes('video') ? 'MAXIMIZE' : 'MINIMIZE'}</span>
                {minimizedWidgets.includes('video') ? <Plus size={10} /> : <X size={10} className="rotate-45" />}
              </div>
            </div>
            {!minimizedWidgets.includes('video') && (
              <div className="relative overflow-hidden rounded-lg">
                <div className={cn("transition-all", !isPremium && "opacity-40 grayscale-[0.3] pointer-events-none")}>
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    <button 
                      onClick={() => {
                        playSound('click');
                        setVideoQuality('720p');
                      }}
                      className={cn(
                        "bg-[#18181c] border rounded-md p-2 text-center cursor-pointer transition-all",
                        videoQuality === '720p' ? "border-[#f5c518] bg-[#1a1200]" : "border-[#252528]"
                      )}
                    >
                      <div className="text-[16px] mb-1">📹</div>
                      <div className={cn("text-[9px] font-serif tracking-wider uppercase", videoQuality === '720p' ? "text-[#e2ddd4]" : "text-[#8a857c]")}>720p HD</div>
                    </button>
                    <button 
                      onClick={() => {
                        playSound('click');
                        setVideoQuality('1080p');
                      }}
                      className={cn(
                        "bg-[#18181c] border rounded-md p-2 text-center cursor-pointer transition-all",
                        videoQuality === '1080p' ? "border-[#f5c518] bg-[#1a1200]" : "border-[#252528]"
                      )}
                    >
                      <div className="text-[16px] mb-1">🎬</div>
                      <div className={cn("text-[9px] font-serif tracking-wider uppercase", videoQuality === '1080p' ? "text-[#e2ddd4]" : "text-[#8a857c]")}>1080p FHD</div>
                    </button>
                    <button 
                      onClick={() => {
                        playSound('click');
                        setIncludeLabels(!includeLabels);
                      }}
                      className={cn(
                        "bg-[#18181c] border rounded-md p-2 text-center cursor-pointer transition-all",
                        includeLabels ? "border-[#f5c518] bg-[#1a1200]" : "border-[#252528]"
                      )}
                    >
                      <div className="text-[16px] mb-1">💬</div>
                      <div className={cn("text-[9px] font-serif tracking-wider uppercase", includeLabels ? "text-[#e2ddd4]" : "text-[#8a857c]")}>Move Labels</div>
                    </button>
                    <button 
                      onClick={() => {
                        playSound('click');
                        setIncludeEval(!includeEval);
                      }}
                      className={cn(
                        "bg-[#18181c] border rounded-md p-2 text-center cursor-pointer transition-all",
                        includeEval ? "border-[#f5c518] bg-[#1a1200]" : "border-[#252528]"
                      )}
                    >
                      <div className="text-[16px] mb-1">📊</div>
                      <div className={cn("text-[9px] font-serif tracking-wider uppercase", includeEval ? "text-[#e2ddd4]" : "text-[#8a857c]")}>Eval Bar</div>
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      playSound('click');
                      handleDownloadVideo();
                    }}
                    disabled={isRecording}
                    className="w-full py-2.5 bg-gradient-to-br from-[#f5c518] to-[#c9970e] border-none rounded-md text-[#120900] font-bold text-[12px] font-serif tracking-wider hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRecording ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {isRecording ? `Recording... ${recordingProgress}%` : 'Download Replay Video'}
                  </button>
                </div>
                {!isPremium && (
                  <div 
                    onClick={() => {
                      playSound('click');
                      setShowPremiumModal(true);
                    }} 
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer bg-black/20 backdrop-blur-[1px] rounded-lg group"
                  >
                    <Lock size={18} className="text-[#f5c518] group-hover:scale-110 transition-transform" />
                    <span className="font-serif text-[10px] text-[#f5c518] tracking-widest uppercase font-bold">Premium Only</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Actions */}
          <div className="grid grid-cols-2 gap-2 p-3">
            <button 
              onClick={() => {
                playSound('click');
                handleSave();
              }}
              disabled={isSaving}
              className="px-3 py-2.5 rounded-md bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] text-[11px] font-serif font-bold tracking-wider hover:brightness-110 transition-all uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? 'Saving...' : 'Save Session'}
            </button>
            <button 
              onClick={() => {
                playSound('click');
                triggerDelete();
              }}
              className="px-3 py-2.5 rounded-md border border-[#3a1515] bg-[#18181c] text-[#e05252] text-[11px] font-serif font-bold tracking-wider hover:bg-[#222228] transition-all uppercase flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>

          </div>
        )}
      </div>

      {/* Premium Modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPremiumModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0e0b14] border border-[#4a1d96] rounded-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col shadow-[0_0_80px_rgba(168,85,247,0.3)] overflow-hidden"
            >
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <div className="bg-gradient-to-br from-[#1a0d2e] to-[#0d0620] p-6 md:p-8 text-center relative">
                  <div className="text-[32px] md:text-[46px] mb-2">♛</div>
                  <h2 className="font-serif text-[20px] md:text-[24px] text-[#f5c518] tracking-widest uppercase">Clash of Crowns Premium</h2>
                  <p className="text-[11px] md:text-[13px] text-[#9a86c4] mt-1">Unlock the full power of AI-driven chess analysis</p>
                  
                  <button 
                    onClick={() => setShowPremiumModal(false)}
                    className="absolute top-4 right-4 text-[#a855f7] hover:text-white transition-colors p-2"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-5 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {/* Premium Bundle */}
                    <div className="relative bg-[#1a0d2e] border-2 border-[#a855f7] rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(168,85,247,0.2)] flex flex-col">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white px-3 py-0.5 rounded-full text-[9px] font-serif font-bold tracking-wider whitespace-nowrap">⭐ PRO BUNDLE</div>
                      <div className="font-serif text-[11px] text-[#c084fc] tracking-[0.2em] mb-2 uppercase">PREMIUM</div>
                      <div className="font-serif text-[36px] font-bold text-[#f5c518]">₹{includeUndo ? (PRICING_CONFIG.PREMIUM_MONTHLY + PRICING_CONFIG.UNDO_ADDON_MONTHLY) : PRICING_CONFIG.PREMIUM_MONTHLY}</div>
                      <div className="text-[9px] text-[#524e48] uppercase tracking-widest mb-4">per month</div>
                      
                      <div 
                        onClick={() => {
                          playSound('click');
                          setIncludeUndo(!includeUndo);
                        }}
                        className={`mt-auto p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${includeUndo ? 'border-[#f5c518] bg-[#f5c518]/10' : 'border-white/10 bg-white/5'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${includeUndo ? 'bg-[#f5c518] border-[#f5c518]' : 'border-white/20'}`}>
                            {includeUndo && <CheckCircle2 size={12} className="text-black" />}
                          </div>
                          <div className="text-left">
                            <div className="text-[9px] font-bold text-white uppercase">Undo Add-on</div>
                            <div className="text-[8px] text-white/40">+₹{PRICING_CONFIG.UNDO_ADDON_MONTHLY}</div>
                          </div>
                        </div>
                        <Zap size={14} className={includeUndo ? 'text-[#f5c518]' : 'text-white/20'} />
                      </div>

                      <button 
                        onClick={() => {
                          playSound('click');
                          handleUpgrade('premium');
                        }}
                        className="mt-4 w-full py-2.5 rounded-lg bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white font-serif font-bold text-[11px] tracking-wider uppercase shadow-lg hover:brightness-110 transition-all"
                      >
                        Get Bundle
                      </button>
                    </div>

                    {/* Standalone Undo */}
                    <div className="relative bg-[#1a1608] border-2 border-[#d9ad33]/40 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(217,173,51,0.1)] flex flex-col">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#d9ad33] text-black px-3 py-0.5 rounded-full text-[9px] font-serif font-bold tracking-wider whitespace-nowrap uppercase">Undo Only</div>
                      <div className="font-serif text-[11px] text-[#d9ad33] tracking-[0.2em] mb-2 uppercase">Standalone</div>
                      
                      <div className="space-y-2 mt-2 mb-4">
                        <button 
                          onClick={() => { playSound('click'); setSelectedUndoPlan('day'); }}
                          className={cn(
                            "w-full p-2 border rounded-lg flex items-center justify-between transition-all",
                            selectedUndoPlan === 'day' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <span className="text-[10px] text-white/80">Daily Pass</span>
                          <span className="text-[11px] font-bold text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_DAILY}</span>
                        </button>
                        <button 
                          onClick={() => { playSound('click'); setSelectedUndoPlan('month'); }}
                          className={cn(
                            "w-full p-2 border rounded-lg flex items-center justify-between transition-all",
                            selectedUndoPlan === 'month' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <span className="text-[10px] text-white/80">Monthly Pass</span>
                          <span className="text-[11px] font-bold text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_MONTHLY}</span>
                        </button>
                        <button 
                          onClick={() => { playSound('click'); setSelectedUndoPlan('year'); }}
                          className={cn(
                            "w-full p-2 border rounded-lg flex items-center justify-between transition-all",
                            selectedUndoPlan === 'year' ? "bg-[#d9ad33]/10 border-[#d9ad33]" : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <span className="text-[10px] text-white/80">Yearly Pass</span>
                          <span className="text-[11px] font-bold text-[#f5c518]">₹{PRICING_CONFIG.UNDO_PASS_YEARLY}</span>
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => {
                          playSound('click');
                          handleUpgrade(`undo_${selectedUndoPlan}` as any);
                        }}
                        className="mt-auto w-full py-2.5 rounded-lg bg-[#d9ad33] text-black font-serif font-bold text-[11px] tracking-wider uppercase shadow-lg hover:bg-[#f5d666] transition-all"
                      >
                        Buy Undo Pass
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-8 bg-white/5 rounded-xl p-4 border border-white/5">
                    <FeatureRow text="Full Move History & Navigation" unlocked />
                    <FeatureRow text="AI Grandmaster Analysis per Move" />
                    <FeatureRow text="Position Evaluation Bar" />
                    <FeatureRow text="Accuracy % & ACPL Score" />
                    <FeatureRow text="Video Replay Export (1080p)" />
                    <FeatureRow text="Unlimited Undos (Add-on/Standalone)" />
                  </div>

                  <div className="flex justify-center">
                    <button 
                      onClick={() => {
                        playSound('click');
                        setShowPremiumModal(false);
                      }}
                      className="px-8 py-3 rounded-xl border border-[#323238] bg-[#18181c] text-[#8a857c] font-serif font-bold text-[12px] tracking-wider uppercase hover:bg-[#252528] transition-all"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelDelete}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-[400px] p-8 text-center shadow-2xl"
            >
              <div className="text-[44px] mb-4">⚠️</div>
              <h2 className="font-serif text-[18px] text-[#f5c518] tracking-widest uppercase mb-2">Session Ending</h2>
              <p className="text-[13px] text-[#8a857c] leading-relaxed mb-4">
                This gameplay data will be permanently deleted. It auto-deletes when you leave or start a new session.
              </p>
              <div className="text-[44px] font-mono font-bold text-[#e05252] mb-6 animate-pulse">
                {isDeleting ? <Loader2 size={44} className="animate-spin mx-auto" /> : deleteCountdown}
              </div>
              <div className="flex flex-wrap gap-2.5 justify-center">
                <button 
                  onClick={() => {
                    playSound('click');
                    handleSave();
                  }}
                  disabled={isSaving || isDeleting}
                  className="px-5 py-2.5 rounded-md bg-gradient-to-br from-[#f5c518] to-[#c9970e] text-[#120900] text-[11px] font-serif font-bold tracking-wider uppercase disabled:opacity-50"
                >
                  {isSaving ? '...' : '💾 Save'}
                </button>
                <button 
                  onClick={() => {
                    playSound('click');
                    cancelDelete();
                  }}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-md border border-[#323238] bg-[#18181c] text-[#e2ddd4] text-[11px] font-serif font-bold tracking-wider uppercase disabled:opacity-50"
                >
                  Stay
                </button>
                <button 
                  onClick={() => {
                    playSound('click');
                    clearInterval(deleteTimerRef.current);
                    handleFinalDelete();
                  }}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-md border border-[#3a1515] bg-[#18181c] text-[#e05252] text-[11px] font-serif font-bold tracking-wider uppercase disabled:opacity-50"
                >
                  {isDeleting ? '...' : '🗑 Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Popup */}
      <AnimatePresence>
        {showSavedPopup && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#4ec97a] text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl z-[500]"
          >
            <CheckCircle2 size={20} />
            <span className="font-serif font-bold tracking-widest uppercase text-xs">Saved Successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Mobile Tab Bar */}
      {isMobileLayout && (
        <div className="h-12 flex-shrink-0 bg-[#060608] border-t border-[#252528] flex items-center justify-around z-50">
          <button
            onClick={() => { playSound('click'); setActiveTab('board'); }}
            className={cn(
              "flex-grow py-3 text-[10px] font-serif font-bold tracking-widest uppercase text-center transition-all",
              activeTab === 'board' ? "text-[#f5c518] bg-white/5" : "text-white/40 hover:text-white/60"
            )}
          >
            🎯 Board
          </button>
          <button
            onClick={() => { playSound('click'); setActiveTab('moves'); }}
            className={cn(
              "flex-grow py-3 text-[10px] font-serif font-bold tracking-widest uppercase text-center transition-all",
              activeTab === 'moves' ? "text-[#f5c518] bg-white/5" : "text-white/40 hover:text-white/60"
            )}
          >
            📜 Moves
          </button>
          <button
            onClick={() => { playSound('click'); setActiveTab('analysis'); }}
            className={cn(
              "flex-grow py-3 text-[10px] font-serif font-bold tracking-widest uppercase text-center transition-all",
              activeTab === 'analysis' ? "text-[#f5c518] bg-white/5" : "text-white/40 hover:text-white/60"
            )}
          >
            📊 Analysis
          </button>
        </div>
      )}
    </div>
  );
}

function PlanCard({ name, price, unit, popular }: { name: string, price: string, unit: string, popular?: boolean }) {
  return (
    <div className={cn(
      "relative bg-[#13101a] border rounded-lg p-3 text-center cursor-pointer transition-all hover:border-[#7c3aed]",
      popular ? "border-[#a855f7] bg-[#1a0d2e] shadow-[0_0_24px_rgba(168,85,247,0.2)]" : "border-[#2a2040]"
    )}>
      {popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white px-3 py-0.5 rounded-full text-[9px] font-serif font-bold tracking-wider whitespace-nowrap">⭐ POPULAR</div>}
      <div className="font-serif text-[11px] text-[#c084fc] tracking-widest mb-2 uppercase">{name}</div>
      <div className="font-serif text-[28px] font-bold text-[#f5c518]">{price}</div>
      <div className="text-[10px] text-[#524e48] mb-1.5">{unit}</div>
      {popular && <div className="text-[10px] text-[#4ec97a] font-serif uppercase">Save ₹68</div>}
    </div>
  );
}

function FeatureRow({ text, unlocked }: { text: string, unlocked?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#1a1a22] last:border-none">
      <span className={cn("w-5 text-center text-[12px]", unlocked ? "text-[#4ec97a]" : "text-[#e05252]")}>
        {unlocked ? '✓' : '★'}
      </span>
      <span className="text-[12px] text-[#bbb] flex-1">{text}</span>
      <span className={cn("text-[9px] font-bold uppercase", unlocked ? "text-[#4ec97a]" : "text-[#a855f7]")}>
        {unlocked ? 'FREE' : 'PREMIUM'}
      </span>
    </div>
  );
}
