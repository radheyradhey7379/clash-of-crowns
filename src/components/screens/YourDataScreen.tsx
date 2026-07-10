import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft, Shield, Trash2, AlertTriangle, Activity, Award } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';
import { playSound } from '../../lib/sounds';
import { deleteAccountData } from '../../services/account/deleteAccountService';

interface YourDataScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
  onDataDeleted: () => void;
  onResetStats: () => void;
  onResetProgress: () => void;
}

export default function YourDataScreen({ 
  onNavigate, 
  playerData, 
  onDataDeleted, 
  onResetStats, 
  onResetProgress 
}: YourDataScreenProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetStatsModal, setShowResetStatsModal] = useState(false);
  const [showResetProgressModal, setShowResetProgressModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteAccountData(playerData.uid || '');
      onDataDeleted();
    } catch (err) {
      console.error('[YourData] Delete failed:', err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#030204] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between z-10 w-full px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('click'); onNavigate('Settings'); }}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#d9ad33]">
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-lg font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">Your Data</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 w-full overflow-y-auto z-10" style={{
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
      }}>
        <div className="max-w-2xl w-full mx-auto flex flex-col gap-5 pt-2 pb-8">

          {/* Privacy Policy */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSound('click'); onNavigate('PrivacyPolicy'); }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left"
          >
            <Shield size={20} className="text-[#d9ad33] flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold tracking-wide">Privacy Policy</span>
              <span className="text-[#8c7a52] text-xs mt-0.5">How we handle your information</span>
            </div>
          </motion.button>

          {/* Terms of Service */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSound('click'); onNavigate('TermsOfService'); }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left"
          >
            <Shield size={20} className="text-[#d9ad33] flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold tracking-wide">Terms of Service</span>
              <span className="text-[#8c7a52] text-xs mt-0.5">Rules and conditions of use</span>
            </div>
          </motion.button>

          {/* Divider */}
          <div className="h-px bg-white/5 my-2" />

          {/* Reset Stats */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSound('click'); setShowResetStatsModal(true); }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-yellow-950/30 border border-yellow-500/20 rounded-xl hover:bg-yellow-950/50 transition-all text-left"
          >
            <Activity size={20} className="text-yellow-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-yellow-400 text-sm font-semibold tracking-wide">Reset Play Stats</span>
              <span className="text-yellow-500/50 text-xs mt-0.5">Reset win, loss, and play duration metrics</span>
            </div>
          </motion.button>

          {/* Reset Progress */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSound('click'); setShowResetProgressModal(true); }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-blue-950/30 border border-blue-500/20 rounded-xl hover:bg-blue-950/50 transition-all text-left"
          >
            <Award size={20} className="text-blue-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-blue-400 text-sm font-semibold tracking-wide">Reset Career Progress</span>
              <span className="text-blue-500/50 text-xs mt-0.5">Reset campaign progress, levels, and Elo rating</span>
            </div>
          </motion.button>

          {/* Delete All My Data */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { playSound('click'); setShowDeleteModal(true); }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-red-950/30 border border-red-500/20 rounded-xl hover:bg-red-950/50 transition-all text-left"
          >
            <Trash2 size={20} className="text-red-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-red-400 text-sm font-semibold tracking-wide">Delete All My Data</span>
              <span className="text-red-400/50 text-xs mt-0.5">Permanently erase your account and progress</span>
            </div>
          </motion.button>

        </div>
      </div>

      {/* Reset Stats Modal */}
      <AnimatePresence>
        {showResetStatsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowResetStatsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0b0a0d] border border-yellow-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-yellow-400" />
                <h2 className="text-yellow-400 text-lg font-bold tracking-wide">Reset Play Stats</h2>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-6">
                Are you sure you want to reset your statistics (wins, losses, streaks, play times)? Your campaign levels and ELO rating will remain intact.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetStatsModal(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    onResetStats();
                    setShowResetStatsModal(false);
                    alert("Stats reset successfully.");
                  }}
                  className="flex-1 py-3 bg-yellow-600 border border-yellow-500 text-black text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-yellow-500 transition-all"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Progress Modal */}
      <AnimatePresence>
        {showResetProgressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowResetProgressModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0b0a0d] border border-blue-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-blue-400" />
                <h2 className="text-blue-400 text-lg font-bold tracking-wide">Reset Career Progress</h2>
              </div>
              <p className="text-white/70 text-sm leading-relaxed mb-6">
                Are you sure you want to reset your career progression (completed levels, unlocked bots, ELO rating)? Your match statistics history will remain intact.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetProgressModal(false)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    playSound('click');
                    onResetProgress();
                    setShowResetProgressModal(false);
                    alert("Career progress reset successfully.");
                  }}
                  className="flex-1 py-3 bg-blue-600 border border-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all"
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => { if (!isDeleting) setShowDeleteModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0b0a0d] border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle size={24} className="text-red-400" />
                <h2 className="text-red-400 text-lg font-bold tracking-wide">Delete All Data</h2>
              </div>

              <p className="text-white/70 text-sm leading-relaxed mb-2">
                This action is <span className="text-red-400 font-bold">permanent and irreversible</span>. All your progress, statistics, and account data will be erased.
              </p>
              <p className="text-[#8c7a52] text-xs mb-4">
                Type <span className="text-red-400 font-mono font-bold">DELETE</span> below to confirm.
              </p>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                disabled={isDeleting}
                className="w-full py-3 px-4 bg-black/50 border border-white/10 rounded-xl text-white text-sm font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-red-500/40 mb-4"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setConfirmText(''); }}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== 'DELETE' || isDeleting}
                  className="flex-1 py-3 bg-red-600 border border-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-red-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
