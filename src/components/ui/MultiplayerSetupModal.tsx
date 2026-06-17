import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Camera, Copy, Check, Swords, Shield, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { playSound } from '../../lib/sounds';
import { auth, db } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { createFriendRoom, joinRoom, cancelRoom, markRoomActive } from '../../game/multiplayer/multiplayerRoomService';
import { createInvitePayload, parseInvitePayload, validateInvitePayload } from '../../game/multiplayer/multiplayerInvite';
import { setPlayerOnline, setPlayerOffline } from '../../game/multiplayer/multiplayerPresenceService';

interface MultiplayerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerData: any;
  onStart: (config: { roomId: string; role: 'host' | 'guest'; color: 'w' | 'b' }) => void;
}

export default function MultiplayerSetupModal({ isOpen, onClose, playerData, onStart }: MultiplayerSetupModalProps) {
  const [view, setView] = useState<'main' | 'host' | 'join'>('main');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [hostRoomId, setHostRoomId] = useState<string | null>(null);
  const [invitePayload, setInvitePayload] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const roomListenerUnsub = useRef<(() => void) | null>(null);
  const presenceInterval = useRef<any>(null);

  const user = auth.currentUser;
  const isOnline = navigator.onLine;

  useEffect(() => {
    return () => {
      cleanupListeners();
    };
  }, []);

  const cleanupListeners = () => {
    if (roomListenerUnsub.current) {
      roomListenerUnsub.current();
      roomListenerUnsub.current = null;
    }
    if (presenceInterval.current) {
      clearInterval(presenceInterval.current);
      presenceInterval.current = null;
    }
    stopScanner();
  };

  const handleCopyId = () => {
    if (!hostRoomId) return;
    playSound('click');
    navigator.clipboard.writeText(hostRoomId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleCreateRoom = async () => {
    playSound('click');
    if (!user) {
      setErrorMsg("Please sign in to host a match.");
      return;
    }
    setErrorMsg(null);
    try {
      const room = await createFriendRoom(user.uid, playerData.name);
      setHostRoomId(room.roomId);
      setView('host');
      
      const payload = createInvitePayload(room.roomId, user.uid);
      setInvitePayload(payload);

      // Set host presence online
      await setPlayerOnline(room.roomId, user.uid);

      // Start listening for guest joins
      roomListenerUnsub.current = onSnapshot(doc(db, 'multiplayerRooms', room.roomId), async (snap) => {
        if (snap.exists()) {
          const roomData = snap.data();
          if (roomData.status === 'ready' && roomData.guestUid) {
            // Guest has joined. Mark room as active to transition
            cleanupListeners();
            await markRoomActive(room.roomId);
            playSound('success');
            onStart({
              roomId: room.roomId,
              role: 'host',
              color: 'w', // Host plays white
            });
          }
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create room.");
    }
  };

  const handleJoinByInput = async () => {
    playSound('click');
    if (!user) {
      setErrorMsg("Please sign in to join a match.");
      return;
    }
    const cleanId = roomIdInput.trim().toUpperCase();
    if (!cleanId) return;

    setIsJoining(true);
    setErrorMsg(null);

    try {
      const room = await joinRoom(cleanId, user.uid, playerData.name);
      
      // Listen to room to transition to game when host marks it active
      roomListenerUnsub.current = onSnapshot(doc(db, 'multiplayerRooms', cleanId), (snap) => {
        if (snap.exists()) {
          const roomData = snap.data();
          if (roomData.status === 'active') {
            cleanupListeners();
            playSound('success');
            onStart({
              roomId: cleanId,
              role: 'guest',
              color: 'b', // Guest plays black
            });
          }
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to join room.");
      setIsJoining(false);
    }
  };

  const handleCancelHost = async () => {
    playSound('click');
    if (hostRoomId) {
      try {
        await cancelRoom(hostRoomId);
      } catch (e) {
        console.warn("Error cancelling room:", e);
      }
    }
    cleanupListeners();
    setHostRoomId(null);
    setInvitePayload('');
    setView('main');
  };

  const startScanner = async () => {
    playSound('click');
    setShowScanner(true);
    setErrorMsg(null);
    setTimeout(async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const scanner = new Html5QrcodeScanner(
          "mp-qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Camera access denied:", err);
        setErrorMsg("Camera access required for QR scanning.");
        setShowScanner(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();
    const parsed = parseInvitePayload(decodedText);
    if (parsed && validateInvitePayload(parsed)) {
      setRoomIdInput(parsed.roomId);
      playSound('click');
      // Auto join
      setIsJoining(true);
      try {
        if (!user) throw new Error("Please sign in first.");
        await joinRoom(parsed.roomId, user.uid, playerData.name);
        
        roomListenerUnsub.current = onSnapshot(doc(db, 'multiplayerRooms', parsed.roomId), (snap) => {
          if (snap.exists()) {
            const roomData = snap.data();
            if (roomData.status === 'active') {
              cleanupListeners();
              playSound('success');
              onStart({
                roomId: parsed.roomId,
                role: 'guest',
                color: 'b',
              });
            }
          }
        });
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to join room from scanned code.");
        setIsJoining(false);
      }
    } else {
      setErrorMsg("Invalid or expired invite QR code.");
    }
  };

  const onScanFailure = () => {};

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (view === 'host') {
                handleCancelHost();
              } else {
                cleanupListeners();
                onClose();
              }
            }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-[#09090b] border-2 border-[#d9ad33]/30 w-full max-w-md p-6 md:p-8 rounded-3xl shadow-[0_0_50px_rgba(217,173,51,0.15)]"
          >
            <button
              onClick={() => {
                if (view === 'host') {
                  handleCancelHost();
                } else {
                  cleanupListeners();
                  onClose();
                }
              }}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-[#d9ad33]/10 rounded-full flex items-center justify-center mb-4 border border-[#d9ad33]/20">
                <Globe size={32} className="text-[#d9ad33]" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-[#d9ad33] font-serif tracking-[0.2em] uppercase text-center">
                ONLINE FRIEND MATCH
              </h2>
              <p className="text-[#8c7a52] text-[9px] tracking-[0.2em] uppercase mt-1">
                Firestore-synced Friend Match multiplayer
              </p>
            </div>

            {/* Online / Auth Guards */}
            {!isOnline ? (
              <div className="text-center p-4 space-y-4">
                <div className="text-red-500 flex justify-center"><AlertTriangle size={32} /></div>
                <p className="text-white/70 text-xs uppercase tracking-widest leading-relaxed">
                  Connection Required: Please connect to the internet to play multiplayer.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl text-xs hover:bg-white/10"
                >
                  RETURN TO COURT
                </button>
              </div>
            ) : !user ? (
              <div className="text-center p-4 space-y-4">
                <div className="text-[#d9ad33] flex justify-center"><Shield size={32} /></div>
                <p className="text-white/70 text-xs uppercase tracking-widest leading-relaxed">
                  Please Sign In to Play Multiplayer.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl text-xs hover:bg-white/10"
                >
                  RETURN TO COURT
                </button>
              </div>
            ) : (
              <div>
                {errorMsg && (
                  <div className="bg-red-900/20 border border-red-500/40 text-red-200 text-[10px] p-3 rounded-xl mb-4 font-mono uppercase text-center">
                    {errorMsg}
                  </div>
                )}

                {view === 'main' && (
                  <div className="space-y-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCreateRoom}
                      className="w-full py-4 bg-gradient-to-r from-[#d9ad33] to-[#8c661a] text-black font-bold tracking-[0.3em] rounded-2xl shadow-xl hover:brightness-110 transition-all uppercase text-xs"
                    >
                      CREATE ROOM (HOST)
                    </motion.button>

                    <div className="relative flex items-center justify-center my-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                      <span className="relative bg-[#09090b] px-3 text-[9px] text-white/40 tracking-[0.3em]">OR</span>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setView('join')}
                      className="w-full py-4 bg-white/5 border border-white/10 text-[#d9ad33] font-bold tracking-[0.3em] rounded-2xl hover:bg-white/10 transition-all uppercase text-xs"
                    >
                      JOIN ROOM (GUEST)
                    </motion.button>
                  </div>
                )}

                {view === 'host' && (
                  <div className="flex flex-col items-center gap-6">
                    <div className="bg-white p-3 rounded-2xl shadow-[0_0_30px_rgba(217,173,51,0.25)]">
                      <QRCodeSVG value={invitePayload} size={160} level="H" includeMargin={true} />
                    </div>

                    <div className="w-full space-y-2 text-center">
                      <span className="text-[#8c7a52] text-[8px] tracking-widest uppercase font-bold">Room ID</span>
                      <div className="flex gap-2 justify-center items-center">
                        <span className="text-xl font-serif text-[#d9ad33] font-bold tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                          {hostRoomId}
                        </span>
                        <button
                          onClick={handleCopyId}
                          className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all relative"
                        >
                          {copySuccess ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-widest mt-2">
                      <div className="w-2 h-2 bg-[#d9ad33] rounded-full animate-ping" />
                      Waiting for Guest to join...
                    </div>

                    <button
                      onClick={handleCancelHost}
                      className="w-full py-3 bg-red-900/10 border border-red-500/20 text-red-400 font-bold tracking-widest rounded-xl text-xs hover:bg-red-900/30 transition-all mt-2"
                    >
                      CANCEL ROOM
                    </button>
                  </div>
                )}

                {view === 'join' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-[#8c7a52] font-bold tracking-widest uppercase flex items-center gap-2">
                        Enter Room ID
                      </label>
                      <input
                        type="text"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d9ad33] transition-colors font-serif tracking-widest text-center uppercase"
                        placeholder="e.g. AB12CD"
                        maxLength={8}
                      />
                    </div>

                    <div className="flex gap-4 mt-4">
                      <button
                        onClick={() => setView('main')}
                        className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl text-xs hover:bg-white/10"
                      >
                        BACK
                      </button>
                      <button
                        onClick={handleJoinByInput}
                        disabled={isJoining || !roomIdInput.trim()}
                        className="flex-1 py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl text-xs hover:bg-[#f5d666] transition-all disabled:opacity-50"
                      >
                        {isJoining ? 'JOINING...' : 'JOIN BATTLE'}
                      </button>
                    </div>

                    <div className="relative flex items-center justify-center my-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                      <span className="relative bg-[#09090b] px-3 text-[9px] text-white/40 tracking-[0.3em]">OR</span>
                    </div>

                    <button
                      onClick={startScanner}
                      className="w-full py-3 bg-white/5 border border-[#d9ad33]/30 text-[#d9ad33] font-bold tracking-widest rounded-xl text-xs hover:bg-white/10 flex items-center justify-center gap-2"
                    >
                      <Camera size={16} />
                      SCAN HOST QR CODE
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* QR Scanner Overlay */}
      {showScanner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={stopScanner}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative bg-[#0f0a05] border-2 border-[#d9ad33] w-full max-w-md p-6 rounded-2xl shadow-2xl z-10"
          >
            <button onClick={stopScanner} className="absolute top-4 right-4 text-[#d9ad33] z-10">
              <X size={24} />
            </button>
            <h2 className="text-xl font-serif text-[#d9ad33] mb-6 tracking-widest text-center">SCAN HOST INVITE</h2>
            
            <div id="mp-qr-reader" className="overflow-hidden rounded-xl border border-[#d9ad33]/30 bg-black min-h-[300px]"></div>
            
            <p className="text-[#8c7a52] text-[10px] text-center mt-6 tracking-widest uppercase font-bold">
              Point your camera at the Host's Room QR code
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
