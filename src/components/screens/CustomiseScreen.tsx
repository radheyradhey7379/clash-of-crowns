import React, { useState, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Check, Sparkles, Palette, Box, Video, 
  Layout, Lock, Crown, Eye, Save, RotateCcw, X 
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Html } from '@react-three/drei';
import { AppScreen, PlayerData } from '../../types';
import { playSound } from '../../lib/sounds';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/translations';
const ChessBoard3D = lazy(() => import('../game/ChessBoard3D'));
import { ChessLogic } from '../../lib/chess-logic';
import ChessBoard2D from '../game/ChessBoard2D';
import { PreviewErrorBoundary } from '../ui/PreviewErrorBoundary';

interface CustomiseScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
  onUpdatePlayerData: (newData: Partial<PlayerData>) => void;
}

export default function CustomiseScreen({ onNavigate, playerData, onUpdatePlayerData }: CustomiseScreenProps) {
  const t = useTranslation(playerData.language || 'en');
  const [activeTab, setActiveTab] = useState<'free' | 'premium'>('free');
  const [pendingData, setPendingData] = useState({
    selectedPieceSet: playerData.selectedPieceSet,
    boardTheme: playerData.boardTheme,
    homeAnimation: playerData.homeAnimation
  });
  const [showPreview, setShowPreview] = useState(false);

  const hasChanges = useMemo(() => {
    return pendingData.selectedPieceSet !== playerData.selectedPieceSet ||
           pendingData.boardTheme !== playerData.boardTheme ||
           pendingData.homeAnimation !== playerData.homeAnimation;
  }, [pendingData, playerData]);

  const pieceSets = [
    { id: 'classic', name: 'Classic Staunton', description: 'Standard tournament style', preview: '♔', color: 'from-gray-400 to-gray-600' },
    { id: 'royal', name: 'Royal Midnight', description: 'Elegant deep blue finish', preview: '♛', color: 'from-blue-600 to-indigo-900' },
    { id: 'literature', name: 'Literature', description: 'Inspired by classic manuscripts', preview: '✎', color: 'from-amber-600 to-orange-900' },
    { id: 'sports', name: 'Sports', description: 'Dynamic athletic theme', preview: '⚽', color: 'from-green-500 to-emerald-800' },
    { id: 'modern', name: 'Modern Abstract', description: 'Sleek minimalist design', preview: '⬡', color: 'from-purple-500 to-pink-800' },
  ] as const;

  const themes = [
    { id: 'classic', name: 'Classic', description: 'Traditional black & white', color: 'bg-zinc-800' },
    { id: 'wood', name: 'Vintage Wood', description: 'Warm mahogany textures', color: 'bg-orange-900' },
    { id: 'marble', name: 'Royal Marble', description: 'Polished stone finish', color: 'bg-stone-300' },
    { id: 'neon', name: 'Cyber Neon', description: 'High-contrast glow', color: 'bg-cyan-900' },
  ] as const;

  const animations = [
    { id: '/bg1.mp4', name: 'Royal Palace', description: 'Cinematic animated background' },
  ];

  const handlePendingUpdate = (key: keyof typeof pendingData, value: any) => {
    playSound('click');
    setPendingData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    playSound('success');
    onUpdatePlayerData(pendingData);
  };

  const handleReset = () => {
    playSound('click');
    setPendingData({
      selectedPieceSet: playerData.selectedPieceSet,
      boardTheme: playerData.boardTheme,
      homeAnimation: playerData.homeAnimation
    });
  };

  // Dummy chess state for preview
  const previewChess = useMemo(() => new ChessLogic(), []);
  const previewBoard = useMemo(() => previewChess.getBoard(), [previewChess]);

  return (
    <div className="screen-root w-full h-full bg-[#000] flex flex-col relative overflow-hidden">
      {/* Background Animation Preview */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <video
          key={pendingData.homeAnimation}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        >
          <source src={pendingData.homeAnimation} type="video/mp4" />
        </video>
      </div>

      {/* Header */}
      <div className="p-6 md:p-10 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent customise-header-bar">
        <div className="flex items-center gap-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playSound('click');
              onNavigate('Home');
            }}
            className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[#d9ad33] hover:bg-white/10 transition-all shadow-xl"
          >
            <ChevronLeft size={28} />
          </motion.button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white font-serif tracking-[0.2em] uppercase">{t.customise || 'Customise'}</h1>
            <p className="text-[#8c7a52] text-xs tracking-[0.3em] uppercase mt-1">Personalise your battlefield</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="hidden md:flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => { playSound('click'); setActiveTab('free'); }}
            className={cn(
              "px-8 py-3 rounded-xl text-xs font-bold tracking-widest transition-all uppercase",
              activeTab === 'free' ? "bg-[#d9ad33] text-black shadow-lg" : "text-white/40 hover:text-white"
            )}
          >
            Free
          </button>
          <button
            onClick={() => { playSound('click'); setActiveTab('premium'); }}
            className={cn(
              "px-8 py-3 rounded-xl text-xs font-bold tracking-widest transition-all uppercase flex items-center gap-2",
              activeTab === 'premium' ? "bg-[#a855f7] text-white shadow-lg" : "text-white/40 hover:text-white"
            )}
          >
            Coming Soon
            <Lock size={12} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 customise-header-actions">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { playSound('click'); setShowPreview(true); }}
            className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold tracking-widest text-xs uppercase hover:bg-white/10 transition-all"
          >
            <Eye size={18} className="text-[#d9ad33]" />
            Preview
          </motion.button>
          
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all"
                  title="Reset Changes"
                >
                  <RotateCcw size={20} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  className="flex items-center gap-2 px-8 py-4 bg-[#d9ad33] rounded-2xl text-black font-bold tracking-widest text-xs uppercase shadow-[0_0_30px_rgba(217,173,51,0.3)]"
                >
                  <Save size={18} />
                  Save Changes
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto z-10 custom-scrollbar customise-content-area">
        <div className="max-w-7xl mx-auto p-6 md:p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'free' ? (
              <motion.div
                key="free-tab"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-16"
              >
                {/* Piece Sets Section */}
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-[#d9ad33]/10 flex items-center justify-center text-[#d9ad33]">
                      <Box size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest uppercase">Piece Collections</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-6 customise-grid-container">
                    {pieceSets.map((set) => (
                      <motion.button
                        key={set.id}
                        whileHover={{ y: -8 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePendingUpdate('selectedPieceSet', set.id)}
                        className={cn(
                          "relative p-6 rounded-3xl border-2 transition-all text-left group overflow-hidden flex flex-col gap-4",
                          pendingData.selectedPieceSet === set.id
                            ? 'border-[#d9ad33] bg-[#d9ad33]/5 shadow-[0_0_30px_rgba(217,173,51,0.1)]'
                            : 'border-white/5 bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className={cn(
                          "w-full aspect-square rounded-2xl bg-gradient-to-br flex items-center justify-center text-5xl shadow-2xl transition-transform group-hover:scale-110",
                          set.color
                        )}>
                          {set.preview}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{set.name}</h3>
                          <p className="text-white/40 text-[10px] leading-relaxed uppercase tracking-wider">{set.description}</p>
                        </div>
                        {pendingData.selectedPieceSet === set.id && (
                          <div className="absolute top-4 right-4 w-6 h-6 bg-[#d9ad33] rounded-full flex items-center justify-center text-black">
                            <Check size={14} strokeWidth={4} />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* Themes Section */}
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-[#d9ad33]/10 flex items-center justify-center text-[#d9ad33]">
                      <Palette size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest uppercase">Board Themes</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 customise-grid-container">
                    {themes.map((theme) => (
                      <motion.button
                        key={theme.id}
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePendingUpdate('boardTheme', theme.id)}
                        className={cn(
                          "relative p-6 rounded-3xl border-2 transition-all text-left group overflow-hidden flex items-center gap-4",
                          pendingData.boardTheme === theme.id
                            ? 'border-[#d9ad33] bg-[#d9ad33]/5'
                            : 'border-white/5 bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className={cn("w-12 h-12 rounded-xl shadow-lg", theme.color)} />
                        <div>
                          <h3 className="text-white font-bold">{theme.name}</h3>
                          <p className="text-white/40 text-[10px] uppercase tracking-wider">{theme.description}</p>
                        </div>
                        {pendingData.boardTheme === theme.id && (
                          <div className="ml-auto w-5 h-5 bg-[#d9ad33] rounded-full flex items-center justify-center text-black">
                            <Check size={12} strokeWidth={4} />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* Home Animation Section */}
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-[#d9ad33]/10 flex items-center justify-center text-[#d9ad33]">
                      <Video size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest uppercase">Home Animation</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-6 customise-grid-container">
                    {animations.map((anim) => (
                      <motion.button
                        key={anim.id}
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handlePendingUpdate('homeAnimation', anim.id)}
                        className={cn(
                          "relative p-6 rounded-3xl border-2 transition-all text-left group overflow-hidden",
                          pendingData.homeAnimation === anim.id
                            ? 'border-[#d9ad33] bg-[#d9ad33]/5'
                            : 'border-white/5 bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className="aspect-video bg-black/40 rounded-xl mb-4 flex items-center justify-center overflow-hidden relative">
                          <Video size={32} className="text-white/10" />
                          {pendingData.homeAnimation === anim.id && (
                            <div className="absolute inset-0 bg-[#d9ad33]/10 flex items-center justify-center">
                              <div className="px-3 py-1 bg-[#d9ad33] text-black text-[8px] font-black tracking-widest rounded-full">ACTIVE</div>
                            </div>
                          )}
                        </div>
                        <h3 className="text-white font-bold">{anim.name}</h3>
                        <p className="text-white/40 text-[10px] uppercase tracking-wider">{anim.description}</p>
                      </motion.button>
                    ))}
                  </div>
                </section>
              </motion.div>
            ) : (
              <motion.div
                key="premium-tab"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-24 h-24 bg-[#a855f7]/10 rounded-full flex items-center justify-center text-[#a855f7] mb-8">
                  <Sparkles size={48} />
                </div>
                <h2 className="text-4xl font-bold text-white font-serif tracking-widest uppercase mb-4">Coming Soon</h2>
                <p className="text-white/40 max-w-md leading-relaxed">
                  We are currently hand-crafting exclusive legendary piece sets, dynamic environments, and ultra-high-fidelity animations for our premium members.
                </p>
                <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-lg">
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                    <Crown className="text-[#a855f7] mb-3" size={24} />
                    <h4 className="text-white font-bold text-sm">Legendary Sets</h4>
                  </div>
                  <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                    <Layout className="text-[#a855f7] mb-3" size={24} />
                    <h4 className="text-white font-bold text-sm">Dynamic Arenas</h4>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-10 customise-preview-backdrop"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full h-full max-w-6xl bg-[#1a1a1e] border border-white/10 rounded-[40px] overflow-hidden flex flex-col relative customise-preview-panel"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-8 right-8 z-50 p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all border border-white/10 customise-preview-close-btn"
              >
                <X size={24} />
              </button>

              {/* 3D View with 2D Fallback */}
              <div className="flex-1 relative">
                <PreviewErrorBoundary fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-[min(70vw,70vh,400px)] aspect-square rounded-2xl overflow-hidden border border-white/10 p-4 bg-black/40 backdrop-blur-xl">
                      <ChessBoard2D 
                        board={previewBoard}
                        selectedSquare={null}
                        validMoves={[]}
                        lastMove={null}
                        onSquareClick={() => {}}
                        playerColor="w"
                        checkInfo={null}
                        turn="w"
                      />
                    </div>
                    <p className="text-white/40 text-xs mt-4">3D Canvas crashed. Displaying 2D preview fallback.</p>
                  </div>
                }>
                  <Canvas shadows dpr={[1, 2]}>
                    <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={45} />
                    <OrbitControls 
                      enablePan={false} 
                      minDistance={5} 
                      maxDistance={15}
                      maxPolarAngle={Math.PI / 2.1}
                    />
                    
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} intensity={1} castShadow />
                    <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                    
                    <Suspense fallback={
                      <Html center>
                        <div className="bg-slate-900/80 px-4 py-2 rounded-lg text-white/80 font-inter text-sm backdrop-blur-sm border border-white/10 whitespace-nowrap">
                          Loading 3D Preview...
                        </div>
                      </Html>
                    }>
                      <ChessBoard3D 
                        board={previewBoard}
                        onSquareClick={() => {}}
                        selectedSquare={null}
                        validMoves={[]}
                        lastMove={null}
                        checkInfo={null}
                        chess={previewChess}
                        setBoard={() => {}}
                        setTurn={() => {}}
                        setLastMove={() => {}}
                        updateCheckInfo={() => {}}
                        checkGameOver={() => {}}
                        setSelectedSquare={() => {}}
                        setValidMoves={() => {}}
                        showHints={false}
                        selectedPieceSet={pendingData.selectedPieceSet}
                        boardTheme={pendingData.boardTheme}
                        capturedPieces={{ w: [], b: [] }}
                      />
                    </Suspense>

                    <Environment preset="apartment" />
                    <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
                  </Canvas>
                </PreviewErrorBoundary>

                {/* Preview Overlay Info */}
                <div className="absolute bottom-10 left-10 z-10 customise-preview-overlay hidden md:block pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl pointer-events-auto">
                    <h3 className="text-[#d9ad33] font-serif text-2xl tracking-widest uppercase mb-2">Live Preview</h3>
                    <div className="space-y-2">
                      <p className="text-white/60 text-xs tracking-widest uppercase">Set: <span className="text-white">{pendingData.selectedPieceSet}</span></p>
                      <p className="text-white/60 text-xs tracking-widest uppercase">Theme: <span className="text-white">{pendingData.boardTheme}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-between customise-preview-footer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#d9ad33]/10 rounded-xl flex items-center justify-center text-[#d9ad33]">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold tracking-widest uppercase text-sm">Visual Inspection</h4>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Rotate and zoom to see every detail</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-8 py-4 text-white/40 hover:text-white font-bold tracking-widest text-xs uppercase transition-all"
                  >
                    Back to Editor
                  </button>
                  <button
                    onClick={() => {
                      handleSave();
                      setShowPreview(false);
                    }}
                    className="px-10 py-4 bg-[#d9ad33] text-black font-bold tracking-widest text-xs uppercase rounded-2xl shadow-xl hover:brightness-110 transition-all"
                  >
                    Apply & Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Actions Bar */}
      <div className="customise-mobile-actions-bar">
        <button
          onClick={() => { playSound('click'); setShowPreview(true); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold tracking-widest text-xs uppercase"
        >
          <Eye size={14} className="text-[#d9ad33]" />
          Preview
        </button>
        
        {hasChanges && (
          <>
            <button
              onClick={handleReset}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-white transition-all"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleSave}
              className="flex-2 flex items-center justify-center gap-2 px-6 py-3 bg-[#d9ad33] rounded-xl text-black font-bold tracking-widest text-xs uppercase"
            >
              <Save size={14} />
              Save
            </button>
          </>
        )}
      </div>
    </div>
  );
}
