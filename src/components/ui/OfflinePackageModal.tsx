import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Play, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { downloadOfflinePackage, getOfflinePackageMetadata, saveOfflinePackageMetadata } from '../../lib/offline/offlinePackage';
import { playSound } from '../../lib/sounds';

interface OfflinePackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloaded?: () => void;
}

export default function OfflinePackageModal({ isOpen, onClose, onDownloaded }: OfflinePackageModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    playSound('click');
    setDownloading(true);
    setError(null);
    setProgress(0);

    const success = await downloadOfflinePackage((p) => {
      setProgress(p);
    });

    setDownloading(false);
    if (success) {
      if (onDownloaded) onDownloaded();
      onClose();
    } else {
      setError("Download failed. Please check your internet connection and try again.");
    }
  };

  const handleSkip = () => {
    playSound('click');
    // Save skipped status in metadata so we don't prompt on every launch
    const metadata = getOfflinePackageMetadata();
    metadata.status = 'not_downloaded'; // keep as not_downloaded but we will store a separate skipped flag
    saveOfflinePackageMetadata(metadata);
    localStorage.setItem('clash_offline_package_prompt_skipped', 'true');
    onClose();
  };

  const handleRemindLater = () => {
    playSound('click');
    // Just close the modal, it will prompt again next time
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="play-popup relative bg-[#030204] border border-white/10 shadow-2xl max-w-md w-full"
          >
            <h2 className="play-popup-title font-bold text-[#d9ad33] font-serif text-center mb-4 tracking-[0.3em] uppercase">
              OFFLINE GAMEPLAY
            </h2>

            <div className="text-center mb-6">
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                For the smoothest offline chess experience, download the offline game package once. It helps reduce lag and lets you play vs Computer without internet.
              </p>
              <p className="text-[#8c7a52] text-xs uppercase tracking-widest leading-normal">
                Includes: Local Stockfish Engine, Low-Poly Assets, Compressed Textures, and Audio.
              </p>
            </div>

            {downloading ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10 mb-2">
                  <motion.div
                    className="bg-gradient-to-r from-[#f5d666] to-[#d9ad33] h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <span className="text-[#f5d666] font-mono text-xs uppercase tracking-widest">
                  Downloading Assets... {progress}%
                </span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 border border-red-500/20 p-3 rounded-xl">
                  <AlertCircle size={20} className="shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={handleDownload}
                  className="play-mode-button flex items-center justify-center gap-3 border border-white/10 hover:bg-white/5 w-full mt-2"
                >
                  <RefreshCw size={18} className="text-[#d9ad33]" />
                  <span className="text-white font-bold tracking-widest text-sm">RETRY DOWNLOAD</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDownload}
                  className="play-mode-button flex items-center gap-4 border border-white/10 hover:bg-white/5 w-full cursor-pointer"
                >
                  <Download size={20} className="text-[#d9ad33]" />
                  <div className="text-left">
                    <div className="font-bold text-white tracking-widest text-sm uppercase">Download Package</div>
                    <div className="play-mode-subtitle text-[#8c7a52] uppercase tracking-[0.2em] text-[10px]">Optimal Offline experience (~4MB)</div>
                  </div>
                </button>

                <button
                  onClick={handleSkip}
                  className="play-mode-button flex items-center gap-4 border border-white/10 hover:bg-white/5 w-full cursor-pointer"
                >
                  <Play size={20} className="text-[#8c7a52]" />
                  <div className="text-left">
                    <div className="font-bold text-white tracking-widest text-sm uppercase">Continue Without Download</div>
                    <div className="play-mode-subtitle text-[#8c7a52] uppercase tracking-[0.2em] text-[10px]">Play locally in 2D with basic AI</div>
                  </div>
                </button>

                <button
                  onClick={handleRemindLater}
                  className="play-mode-button flex items-center gap-4 border border-white/10 hover:bg-white/5 w-full cursor-pointer"
                >
                  <Clock size={20} className="text-[#8c7a52]" />
                  <div className="text-left">
                    <div className="font-bold text-white tracking-widest text-sm uppercase">Remind Me Later</div>
                    <div className="play-mode-subtitle text-[#8c7a52] uppercase tracking-[0.2em] text-[10px]">Ask again on next launch</div>
                  </div>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
