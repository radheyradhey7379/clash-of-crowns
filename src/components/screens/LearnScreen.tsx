import React, { useState, useRef, useEffect } from 'react';
import ScreenBackground from '../ui/ScreenBackground';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft, BookOpen, CheckCircle2 } from 'lucide-react';
import { LESSON_DATA, LessonContent } from '../../lib/lessons';
import LearnDetailScreen from './LearnDetailScreen';

interface LearnScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

export default function LearnScreen({ onNavigate, playerData }: LearnScreenProps) {
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const isNavigatingRef = useRef(false);

  // Sync completed lessons list on mount / active session changes
  const refreshCompletedList = () => {
    try {
      const completed = JSON.parse(localStorage.getItem('clash_academy_completed_lessons') || '[]');
      setCompletedLessons(completed);
    } catch (err) {
      console.error('[LearnScreen] Failed to load completed lessons:', err);
    }
  };

  useEffect(() => {
    refreshCompletedList();
    isNavigatingRef.current = false;
  }, []);

  const lessons = [
    {
      section: "THE CHESS PIECES",
      items: ["PAWN", "KNIGHT", "BISHOP", "ROOK", "QUEEN", "KING"]
    },
    {
      section: "BASIC COMBAT",
      items: ["CHESS NOTATION", "CAPTURING", "CHECK", "OUT OF CHECK"]
    },
    {
      section: "MATCH RESOLUTION",
      items: ["CHECKMATE", "STALEMATE", "PROMOTION"]
    },
    {
      section: "SPECIAL MANEUVERS",
      items: ["CASTLING K-SIDE", "CASTLING Q-SIDE", "EN PASSANT"]
    }
  ];

  if (selectedLesson) {
    return (
      <LearnDetailScreen 
        lesson={selectedLesson} 
        onBack={() => {
          isNavigatingRef.current = false;
          setSelectedLesson(null);
          refreshCompletedList();
        }} 
      />
    );
  }

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#000] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-20 flex items-center justify-between px-8 z-10">
        <motion.button
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('Home')}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-[#d9ad33]/20 text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-colors"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-[#d9ad33]" />
          <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">CROWNS ACADEMY</h1>
        </div>
        <div className="w-32" />
      </div>

      <div className="flex-1 p-6 md:p-10 overflow-y-auto z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          {lessons.map((section, si) => (
            <div key={section.section}>
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-[#8c7a52] text-xs font-bold tracking-[0.4em] whitespace-nowrap uppercase">{section.section}</h2>
                <div className="h-px bg-white/10 w-full" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {section.items.map((item, ii) => {
                  const data = LESSON_DATA[item];
                  const isCompleted = data ? completedLessons.includes(data.id) : false;

                  return (
                    <motion.button
                      key={item}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (si * 0.1) + (ii * 0.05) }}
                      whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(217, 173, 51, 0.3)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (isNavigatingRef.current) return;
                        if (data) {
                          isNavigatingRef.current = true;
                          setSelectedLesson(data);
                        } else {
                          alert(`Interactive lesson for [${item}] coming soon!`);
                        }
                      }}
                      className={`h-20 bg-black/40 backdrop-blur-md border rounded-2xl flex flex-col items-center justify-center text-center p-3 group transition-all shadow-2xl relative ${
                        isCompleted ? 'border-[#d9ad33]/40' : 'border-white/10'
                      }`}
                    >
                      {isCompleted && (
                        <div className="absolute top-2 right-2 text-[#d9ad33]">
                          <CheckCircle2 size={12} />
                        </div>
                      )}
                      <span className={`text-[10px] font-bold tracking-[0.2em] transition-colors uppercase ${
                        isCompleted ? 'text-[#d9ad33]' : 'text-white group-hover:text-[#d9ad33]'
                      }`}>
                        {item}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

