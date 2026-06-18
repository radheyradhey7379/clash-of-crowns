import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Play, RotateCcw, Info, CheckCircle2, Volume2, Languages, Loader2 } from 'lucide-react';
import { LessonContent } from '../../lib/lessons';
import { ChessLogic } from '../../lib/chess-logic';
import ChessBoard2D from '../game/ChessBoard2D';
import { getNarration, Language, LANGUAGE_LABELS } from '../../services/narrationService';
import { getLocalLessonText, getLocalLessonObj } from '../../services/lessonTranslations';

interface LearnDetailScreenProps {
  lesson: LessonContent;
  onBack: () => void;
}

export default function LearnDetailScreen({ lesson, onBack }: LearnDetailScreenProps) {
  const [logic, setLogic] = useState(new ChessLogic(lesson.fen));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<any[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);
  const [isNarrating, setIsNarrating] = useState(false);
  const [narrationLang, setNarrationLang] = useState<Language>('en');
  const [narrationText, setNarrationText] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [voiceAlert, setVoiceAlert] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMounted = useRef(true);
  const narrationTimeoutRef = useRef<any>(null);

  // Reset logic when lesson changes
  useEffect(() => {
    isMounted.current = true;
    setLogic(new ChessLogic(lesson.fen));
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setDemoIndex(0);
    setIsDemoPlaying(false);
    stopNarration();

    return () => {
      isMounted.current = false;
      stopNarration();
    };
  }, [lesson]);

  // Pre-load speechSynthesis voices to trigger browser loading (especially on Android WebViews)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);

  const stopNarration = () => {
    if (narrationTimeoutRef.current) {
      clearTimeout(narrationTimeoutRef.current);
      narrationTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsNarrating(false);
    setNarrationText(null);
    setIsFallback(false);
    setVoiceAlert(null);
  };

  const playSpeechSynthesisFallback = (text: string, lang: Language, alternativeTranslatedText?: string): boolean => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("SpeechSynthesis not supported in this browser.");
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      
      let targetLang = 'en-US';
      if (lang === 'hi') {
        targetLang = 'hi-IN';
      } else if (lang === 'ar') {
        targetLang = 'ar-SA';
      }
      
      const localTransText = lang !== 'en' ? getLocalLessonText(lesson.id, lang) : '';
      const speechText = alternativeTranslatedText || localTransText || text;
      
      setNarrationText(speechText);
      setIsFallback(true);

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = targetLang;

      // Select matching voice
      const voices = window.speechSynthesis.getVoices();
      let matchingVoice = voices.find(v => {
        const vLang = v.lang.toLowerCase();
        if (lang === 'hi') {
          return vLang.startsWith('hi');
        }
        if (lang === 'ar') {
          return vLang.startsWith('ar');
        }
        return vLang === targetLang.toLowerCase() || vLang.startsWith(targetLang.split('-')[0].toLowerCase());
      });
      
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      } else if (lang !== 'en') {
        setVoiceAlert("Exact Hindi/Arabic voice not available, using default voice.");
        setTimeout(() => {
          if (isMounted.current) setVoiceAlert(null);
        }, 4000);
      }

      utterance.onend = () => {
        if (isMounted.current) {
          stopNarration();
        }
      };

      utterance.onerror = (e) => {
        console.error("SpeechSynthesis utterance error:", e);
        if (isMounted.current) {
          stopNarration();
        }
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.error("Failed to play speechSynthesis:", err);
      return false;
    }
  };

  const handleNarration = async (lang: Language) => {
    setShowLangMenu(false);
    
    const isDifferentLang = isNarrating && lang !== narrationLang;
    
    if (isNarrating) {
      stopNarration();
      if (!isDifferentLang) {
        return;
      }
    }
    
    setNarrationLang(lang);
    setIsFallback(false);
    
    const fullText = `${lesson.title}. ${lesson.description}. Rules: ${lesson.rules.join('. ')}`;
    const localText = lang !== 'en' ? getLocalLessonText(lesson.id, lang) : fullText;
    setNarrationText(localText);
    setIsNarrating(true);

    // Setup a 30s safety timeout to prevent infinite spinner
    if (narrationTimeoutRef.current) {
      clearTimeout(narrationTimeoutRef.current);
    }
    narrationTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        console.warn("[LearnDetailScreen] Narration timeout safeguard triggered (30s limit).");
        stopNarration();
      }
    }, 30000);

    // If offline, fallback synchronously to preserve user gesture
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      const success = playSpeechSynthesisFallback(fullText, lang);
      if (!success) {
        stopNarration();
      }
      return;
    }

    // Create and play/pause empty audio synchronously to unlock the Audio context on mobile browsers
    const audio = new Audio();
    audio.play().catch(() => {}); // silent catch to unlock audio element
    audioRef.current = audio;
    
    let serverTranslatedText: string | undefined = undefined;
    
    try {
      const response = await getNarration(fullText, lang);

      if (response && isMounted.current) {
        const { audioUrl, translatedText } = response;
        serverTranslatedText = translatedText;
        if (translatedText) {
          setNarrationText(translatedText);
        }
        
        audio.src = audioUrl;
        audio.onended = () => {
          if (isMounted.current) {
            URL.revokeObjectURL(audioUrl);
            stopNarration();
          }
        };
        audio.play().catch(e => {
          console.error("Audio playback failed even after unlocking:", e);
          if (isMounted.current) {
            const success = playSpeechSynthesisFallback(fullText, lang, serverTranslatedText);
            if (!success) {
              stopNarration();
              URL.revokeObjectURL(audioUrl);
            }
          }
        });
      } else {
        if (isMounted.current) {
          const success = playSpeechSynthesisFallback(fullText, lang);
          if (!success) {
            stopNarration();
          }
        }
      }
    } catch (error) {
      console.error("Narration failed:", error);
      if (isMounted.current) {
        const success = playSpeechSynthesisFallback(fullText, lang, serverTranslatedText);
        if (!success) {
          stopNarration();
        }
      }
    }
  };

  const handleSquareClick = (square: string) => {
    if (isDemoPlaying) return;

    const piece = logic.getBoard()[8 - parseInt(square[1])][square.charCodeAt(0) - 97];

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (piece && piece.color === logic.getTurn()) {
      setSelectedSquare(square);
      setValidMoves(logic.getMoves(square));
    } else if (selectedSquare) {
      const move = logic.makeMove({ from: selectedSquare, to: square, promotion: 'q' });
      if (move) {
        setLastMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setValidMoves([]);
        // Re-render board
        setLogic(new ChessLogic(logic.getFen()));
      }
    }
  };

  const playDemo = async () => {
    if (!lesson.demoMoves || lesson.demoMoves.length === 0) return;
    
    setIsDemoPlaying(true);
    const demoLogic = new ChessLogic(lesson.fen);
    setLogic(demoLogic);
    setLastMove(null);
    
    for (const moveStr of lesson.demoMoves) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const move = demoLogic.makeMove(moveStr);
      if (move) {
        setLastMove({ from: move.from, to: move.to });
        setLogic(new ChessLogic(demoLogic.getFen()));
      }
    }
    
    setIsDemoPlaying(false);
  };

  const resetBoard = () => {
    setLogic(new ChessLogic(lesson.fen));
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setIsDemoPlaying(false);
  };

  const getCheckInfo = () => {
    if (!logic.isCheck()) return null;
    
    const board = logic.getBoard();
    const turn = logic.getTurn();
    let kingPos = "";
    
    // Find the king of the current turn
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece && piece.type === 'k' && piece.color === turn) {
          kingPos = `${String.fromCharCode(97 + f)}${8 - r}`;
          break;
        }
      }
      if (kingPos) break;
    }
    
    return { king: kingPos, checker: "" }; // Checker pos is harder to find without more logic, but king highlight is enough
  };

  return (
    <div className="screen-root w-full h-full flex flex-col bg-[#000] relative overflow-hidden">
      {/* Top Bar */}
      <div className="h-20 flex items-center justify-between px-8 z-30 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <motion.button
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-[#d9ad33]/20 text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-colors"
        >
          <ChevronLeft size={20} />
        </motion.button>
        
        <div className="flex flex-col items-center">
          <span className="text-[#524e48] text-[10px] font-bold tracking-[0.4em] uppercase mb-1">{lesson.section}</span>
          <h1 className="text-xl font-bold text-white tracking-[0.2em] font-serif uppercase">{lesson.title}</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                isNarrating 
                  ? 'bg-[#d9ad33] text-[#030204] border-[#d9ad33]' 
                  : 'bg-white/5 text-[#d9ad33] border-white/10 hover:border-[#d9ad33]/50'
              }`}
            >
              {isNarrating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Volume2 size={18} />
              )}
              <span className="text-[10px] font-bold tracking-widest uppercase">
                {isNarrating ? `Narrating (${narrationLang})` : 'Narration'}
              </span>
            </motion.button>

            <AnimatePresence>
              {showLangMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a1e] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                >
                  <div className="p-2 border-b border-white/5 flex items-center gap-2">
                    <Languages size={12} className="text-[#524e48]" />
                    <span className="text-[8px] text-[#524e48] font-bold tracking-widest uppercase">Select Language</span>
                  </div>
                  {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleNarration(lang)}
                      className="w-full px-4 py-3 text-left text-xs text-white/70 hover:text-[#d9ad33] hover:bg-white/5 transition-colors flex items-center justify-between group"
                    >
                      <span>{LANGUAGE_LABELS[lang]}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#d9ad33] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={resetBoard}
            className="p-2 text-[#524e48] hover:text-[#d9ad33] transition-colors"
            title="Reset Board"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Side: Rules & Info (Scrollable) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-[140px] xs:w-[180px] sm:w-[300px] md:w-[400px] lg:w-[450px] flex-shrink-0 border-r border-white/5 flex flex-col bg-black/40 backdrop-blur-md"
        >
          <div className="flex-1 overflow-y-auto p-3 xs:p-4 sm:p-6 md:p-8 custom-scrollbar">
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#d9ad33]/10 flex items-center justify-center">
                  <Info size={14} className="text-[#d9ad33]" />
                </div>
                <h2 className="text-[#d9ad33] font-bold tracking-widest text-[8px] sm:text-xs uppercase">Overview</h2>
              </div>
              <p className="text-[#f5d666] leading-relaxed font-serif italic text-xs sm:text-base md:text-lg border-l-2 border-[#d9ad33] pl-3 sm:pl-4 py-1">
                "{lesson.description}"
              </p>
              <AnimatePresence>
                {narrationText && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-3 rounded-xl bg-[#d9ad33]/10 border border-[#d9ad33]/20 overflow-hidden"
                  >
                    <span className="text-[7px] sm:text-[9px] text-[#d9ad33] font-black uppercase tracking-wider block mb-1">
                      {isFallback ? "🗣️ Local Narration (Fallback)" : "🗣️ Live Narration"}
                    </span>
                    <p className="text-[10px] sm:text-xs text-[#e2ddd4] leading-relaxed italic">
                      "{narrationText}"
                    </p>
                    {voiceAlert && (
                      <span className="text-[8px] text-amber-500 font-bold block mt-2 animate-pulse">
                        ⚠️ {voiceAlert}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-[#d9ad33]/10 flex items-center justify-center">
                  <CheckCircle2 size={14} className="text-[#d9ad33]" />
                </div>
                <h2 className="text-[#d9ad33] font-bold tracking-widest text-[8px] sm:text-xs uppercase">Rules of Engagement</h2>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                {lesson.rules.map((rule, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="flex gap-2 sm:gap-4 p-2 sm:p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#d9ad33]/30 transition-all group"
                  >
                    <span className="text-[#d9ad33] font-mono text-[8px] sm:text-[10px] mt-0.5 sm:mt-1">0{index + 1}</span>
                    <p className="text-white/70 text-[9px] sm:text-xs md:text-sm leading-relaxed group-hover:text-white transition-colors">
                      {rule}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            {lesson.demoMoves && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={playDemo}
                disabled={isDemoPlaying}
                className="mt-6 sm:mt-8 w-full h-10 sm:h-12 bg-[#d9ad33] text-[#030204] rounded-xl font-bold tracking-[0.2em] text-[8px] sm:text-xs flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(217,173,51,0.2)]"
              >
                <Play size={12} className="sm:w-4 sm:h-4" fill="currentColor" />
                <span>{isDemoPlaying ? "WATCHING..." : "WATCH DEMO"}</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Right Side: Chess Board (Centered) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 bg-[#09090b] p-2 xs:p-4 sm:p-8 lg:p-12 flex items-center justify-center relative overflow-hidden"
        >
          {/* Decorative Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-[#d9ad33]/5 blur-[120px] rounded-full" />
          </div>

          <div 
            className="w-full aspect-square relative z-10 flex items-center justify-center"
            style={{ 
              maxWidth: 'min(70vw, 72vh, 450px)', 
              maxHeight: 'min(70vw, 72vh, 450px)' 
            }}
          >
            <div className="w-full h-full max-h-full max-w-full">
              <ChessBoard2D
                board={logic.getBoard()}
                selectedSquare={selectedSquare}
                validMoves={validMoves}
                lastMove={lastMove}
                onSquareClick={handleSquareClick}
                playerColor="w"
                checkInfo={getCheckInfo()}
              />
            </div>
            
            <div className="absolute -bottom-6 sm:-bottom-10 left-0 w-full flex justify-between items-center px-1 sm:px-2">
              <span className="text-[#524e48] text-[6px] sm:text-[8px] font-bold tracking-widest uppercase">Interactive Training Board</span>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#d9ad33] animate-pulse" />
                <span className="text-[#d9ad33] text-[6px] sm:text-[8px] font-bold tracking-widest uppercase">Live Session</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
