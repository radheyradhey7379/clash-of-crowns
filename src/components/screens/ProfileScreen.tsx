import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS } from '../../types';
import { AI_CHARACTERS } from '../../game/ai/aiCharacters';
import { ChevronLeft, Award, Share2, Users, Search, MessageSquare, Send, X, QrCode, Camera, Download, LogOut } from 'lucide-react';
import { auth, db, searchUserByUid, sendFriendRequest, googleProvider } from '../../lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import * as htmlToImage from 'modern-screenshot';
import { downloadElement, cn } from '../../lib/utils';

export default function ProfileScreen({ 
  onNavigate, 
  playerData, 
  onUpdate,
  viewingUid = null,
  onViewProfile = () => {}
}: { 
  onNavigate: (screen: AppScreen) => void, 
  playerData: PlayerData, 
  onUpdate: (newData: Partial<PlayerData>) => void,
  viewingUid?: string | null,
  onViewProfile?: (uid: string | null) => void
}) {
  const [showSocial, setShowSocial] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [viewedPlayerData, setViewedPlayerData] = useState<PlayerData | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const qrRef = useRef<HTMLDivElement>(null);
  const challengeCardRef = useRef<HTMLDivElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);

  const user = auth.currentUser;

  // Fetch data if viewing someone else
  useEffect(() => {
    if (viewingUid) {
      const fetchViewedUser = async () => {
        const data = await searchUserByUid(viewingUid);
        if (data) setViewedPlayerData(data as any as PlayerData);
      };
      fetchViewedUser();
    } else {
      setViewedPlayerData(null);
    }
  }, [viewingUid]);

  const displayData = viewedPlayerData || playerData;
  const isOwnProfile = !viewingUid || viewingUid === user?.uid;

  const total = displayData.wins + displayData.losses;
  const wr = total > 0 ? (displayData.wins / total) * 100 : 0;

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;

    // Listen for accepted friend requests where user is either sender or receiver
    const q1 = query(collection(db, 'friendRequests'), where('from', '==', user.uid), where('status', '==', 'accepted'));
    const q2 = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'accepted'));
    
    const handleSnapshot = async (snapshot: any, isOutbound: boolean) => {
      try {
        const friendIds = snapshot.docs.map((doc: any) => isOutbound ? doc.data().to : doc.data().from);
        const friendData = await Promise.all(friendIds.map(async (id: string) => {
          return await searchUserByUid(id);
        }));
        
        if (isMounted) {
          setFriends(prev => {
            const combined = [...prev, ...friendData.filter(f => f !== null)];
            const unique = Array.from(new Map(combined.map(item => [item.uid, item])).values());
            return unique;
          });
        }
      } catch (err) {
        console.warn("Error processing friend snapshot:", err);
      }
    };

    const unsub1 = onSnapshot(q1, (snapshot) => handleSnapshot(snapshot, true), (error) => {
      console.warn("Friend requests listener error (outbound):", error.message);
    });

    const unsub2 = onSnapshot(q2, (snapshot) => handleSnapshot(snapshot, false), (error) => {
      console.warn("Friend requests listener error (inbound):", error.message);
    });

    return () => {
      isMounted = false;
      unsub1();
      unsub2();
    };
  }, [user?.uid]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user) {
        onUpdate({
          name: user.displayName || playerData.name,
          photoURL: user.photoURL || "",
        });
      }
    } catch (error) {
      console.error("Sign in failed:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleShare = async () => {
    if (!user) {
      alert("Please sign in to share your Player ID.");
      return;
    }
    const uid = user.uid;
    const shareText = `👑 CLASH OF CROWNS 👑\n\n${playerData.name} has challenged you to a battle in Clash of Crowns!\n\nPlayer ID: ${uid}\n\nRise from Cadet to Grandmaster. Download and play now:\n${window.location.origin}`;
    
    const shareData: any = {
      title: 'Clash of Crowns - Challenge',
      text: shareText,
      url: window.location.origin
    };

    // Try to share Challenge Card image if available
    try {
      if (challengeCardRef.current && navigator.canShare && navigator.canShare({ files: [] })) {
        // Small delay to ensure QR is rendered
        await new Promise(resolve => setTimeout(resolve, 300));
        const blob = await htmlToImage.domToBlob(challengeCardRef.current, {
          backgroundColor: '#030204',
          width: 400,
          height: 600,
          scale: 1,
        });
        if (blob) {
          const file = new File([blob], 'clash-of-crowns-challenge.png', { type: 'image/png' });
          shareData.files = [file];
        }
      }
    } catch (e) {
      console.warn("Could not prepare challenge card for sharing:", e);
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Share failed:', err);
        // Fallback to clipboard
        navigator.clipboard.writeText(uid);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } else {
      navigator.clipboard.writeText(uid);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const downloadChallengeCard = async () => {
    if (!challengeCardRef.current) return;
    try {
      // Small delay to ensure QR is rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      const blob = await htmlToImage.domToBlob(challengeCardRef.current, {
        backgroundColor: '#030204',
        width: 400,
        height: 600,
        scale: 1,
      });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `clash-of-crowns-challenge-${playerData.name}.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to generate challenge card. Please try again.");
    }
  };

  const startScanner = async () => {
    setShowScanner(true);
    setTimeout(async () => {
      try {
        // Explicitly request camera permission first
        await navigator.mediaDevices.getUserMedia({ video: true });
        
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );
        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      } catch (err) {
        console.error("Camera access denied:", err);
        alert("Camera access is required to scan QR codes. Please enable it in your browser settings.");
        setShowScanner(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(error => {
        console.error("Failed to clear scanner:", error);
      });
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();
    setSearchId(decodedText);
    setIsSearching(true);
    const result = await searchUserByUid(decodedText.trim());
    setSearchResult(result);
    setIsSearching(false);
    setShowSocial(true);
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const handleSearch = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    const result = await searchUserByUid(searchId.trim());
    setSearchResult(result);
    setIsSearching(false);
  };

  const handleAddFriend = async () => {
    if (!auth.currentUser || !searchResult) return;
    await sendFriendRequest(auth.currentUser.uid, searchResult.uid);
    alert('Friend request sent!');
  };

  return (
    <div className="screen-root w-full h-full flex flex-col bg-[#000] relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#d9ad33] blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#8c0d0d] blur-[120px] rounded-full" />
      </div>

      <div 
        className="h-20 flex items-center justify-between z-10"
        style={{
          paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
          paddingRight: 'calc(2rem + env(safe-area-inset-right))',
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))'
        }}
      >
        <motion.button
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (viewingUid) {
              onViewProfile(null);
            } else {
              onNavigate('Home');
            }
          }}
          className="flex items-center justify-center p-2 rounded-lg bg-black/30 border border-[#d9ad33]/20 text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-colors"
          title={viewingUid ? 'Back to Profile' : 'Back to Court'}
        >
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">CROWNS PROFILE</h1>
        <div className="flex gap-4">
          {isOwnProfile && (
            <>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (profileCardRef.current) {
                    downloadElement(profileCardRef.current, `clash-of-crowns-profile-${playerData.name}.png`);
                  }
                }}
                className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
                title="Download Profile"
              >
                <Download size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowQR(true)}
                className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
                title="My QR Code"
              >
                <QrCode size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowSocial(true)}
                className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
              >
                <Users size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleShare}
                className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all relative shadow-[0_0_10px_rgba(217,173,51,0.2)]"
              >
                <Share2 size={20} />
                <AnimatePresence>
                  {copySuccess && (
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: -30 }}
                      exit={{ opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 text-[8px] bg-[#d9ad33] text-black px-2 py-1 rounded font-bold whitespace-nowrap"
                    >
                      ID COPIED!
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </>
          )}
        </div>
      </div>

      <div 
        className="flex-1 flex items-center justify-center p-4 md:p-6 z-10 overflow-y-auto"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <motion.div
          ref={profileCardRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 sm:p-6 md:p-8 rounded-2xl max-w-xl w-full relative shadow-2xl my-auto"
        >
          {/* Corner Decorations */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#d9ad33]/30 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#d9ad33]/30 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#d9ad33]/30 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#d9ad33]/30 rounded-br-xl" />
          
          <div className="flex flex-col items-center mb-4 sm:mb-6 md:mb-10">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-[#d9ad33] to-[#8c661a] p-0.5 sm:p-1 shadow-[0_0_20px_rgba(217,173,51,0.2)] mb-4 sm:mb-6">
                <div className="w-full h-full rounded-full bg-[#030204] flex items-center justify-center overflow-hidden border border-black sm:border-2">
                  <img 
                    src={displayData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayData.name}`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              {(displayData as any).role === 'admin' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#d9ad33] text-black px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase shadow-[0_0_20px_rgba(217,173,51,0.5)]">
                   MASTER ADMIN
                </div>
              )}
              {(displayData as any).shadowPool && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                   SHADOW POOL (FLAGGED)
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-[#d9ad33] text-black p-2 rounded-full shadow-lg">
                <Award size={16} />
              </div>
            </div>
            
            <div className="w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {isOwnProfile ? (
                  <input
                    type="text"
                    value={playerData.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    className="bg-transparent border-b border-white/10 text-lg sm:text-2xl md:text-3xl font-bold text-[#f5d666] text-center focus:outline-none focus:border-[#d9ad33] transition-colors pb-1 sm:pb-2 w-full max-w-xs font-serif tracking-wide"
                    placeholder="Name your Crown"
                    maxLength={14}
                  />
                ) : (
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-[#f5d666] text-center font-serif tracking-wide pb-1 sm:pb-2">{displayData.name}</h2>
                )}
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-black tracking-widest shadow-lg",
                  displayData.isPremium 
                    ? "bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
                    : "bg-white/10 text-white/40 border border-white/10"
                )}>
                  {displayData.isPremium ? "PREMIUM" : "FREE"}
                </span>
              </div>
              <span className="text-[#8c7a52] text-[10px] tracking-[0.5em] uppercase font-bold">Crown Identity</span>
              {isOwnProfile ? (
                user ? (
                  <div className="flex flex-col items-center gap-1 mt-2">
                    <span className="text-[#8c7a52] text-[8px] tracking-[0.3em] uppercase font-bold">Player ID</span>
                    <span className="text-[#d9ad33] text-xs tracking-widest font-mono bg-white/5 px-3 py-1 rounded border border-white/5">{user.uid}</span>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="mt-4 px-6 py-2 bg-white/5 border border-white/10 text-[#d9ad33] rounded-full text-xs font-bold tracking-widest hover:bg-white/10 transition-all"
                  >
                    {isSigningIn ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
                  </motion.button>
                )
              ) : (
                <div className="flex flex-col items-center gap-1 mt-2">
                  <span className="text-[#8c7a52] text-[8px] tracking-[0.3em] uppercase font-bold">Player ID</span>
                  <span className="text-[#d9ad33] text-xs tracking-widest font-mono bg-white/5 px-3 py-1 rounded border border-white/5">{viewingUid}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6 md:mb-10">
            <StatCard label="RANK TIER" value={displayData.rating === 0 ? "UNRANKED" : (AI_CHARACTERS.find(c => c.tier === displayData.aiProgress?.tier && c.level === displayData.aiProgress?.level)?.name || "Unknown")} color={TIER_COLORS[Math.min(displayData.tier || 0, 7)]} />
            <StatCard label="WIN RATE" value={`${wr.toFixed(1)}%`} color="#4ade80" />
            <StatCard label="TOTAL BATTLES" value={total.toString()} color="#f5d666" />
          </div>

          <div className="flex flex-col items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (viewingUid) {
                  onViewProfile(null);
                } else {
                  onNavigate('Home');
                }
              }}
              className="px-6 py-2.5 bg-[#d9ad33] text-black font-bold tracking-[0.2em] rounded-full hover:bg-[#f5d666] transition-colors shadow-lg w-full max-w-[240px] text-xs sm:text-sm"
            >
              {viewingUid ? 'CLOSE VIEW' : 'CONFIRM CHANGES'}
            </motion.button>

            {isOwnProfile && user && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-red-900/20 border border-red-500/30 text-red-500 font-bold tracking-[0.2em] rounded-full hover:bg-red-900/40 transition-colors w-full max-w-[240px] text-xs"
              >
                <LogOut size={14} />
                LOG OUT
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111114] border-2 border-red-500/40 p-8 rounded-3xl text-center max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <LogOut size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4 font-serif tracking-widest uppercase">Log Out?</h3>
              <p className="text-white/60 text-sm mb-8 uppercase tracking-wider leading-relaxed">
                Your progress will be saved. Are you sure you want to end your session?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isLoggingOut}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold tracking-widest text-xs uppercase hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsLoggingOut(true);
                    try {
                      if (user) {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, {
                          name: playerData.name,
                          rating: playerData.rating,
                          wins: playerData.wins,
                          losses: playerData.losses,
                          tier: playerData.tier,
                          char: playerData.char,
                          lastActive: new Date().toISOString()
                        });
                      }
                      await signOut(auth);
                      onNavigate('Home');
                    } catch (e) {
                      console.error("Logout error:", e);
                      // Fallback sign out if save fails
                      await signOut(auth).catch(() => {});
                      onNavigate('Home');
                    } finally {
                      setIsLoggingOut(false);
                      setShowLogoutConfirm(false);
                    }
                  }}
                  disabled={isLoggingOut}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold tracking-widest text-xs uppercase hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoggingOut ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social Modal */}
      <AnimatePresence>
        {showSocial && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSocial(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0f0a05] border-2 border-[#d9ad33] w-full max-w-md p-6 rounded shadow-2xl overflow-hidden"
            >
              <button onClick={() => setShowSocial(false)} className="absolute top-4 right-4 text-[#d9ad33]"><X size={24} /></button>
              <h2 className="text-2xl font-serif text-[#d9ad33] mb-6 tracking-widest text-center">CROWNS SOCIAL</h2>
              
              <div className="mb-6 p-3 bg-white/5 border border-[#d9ad33]/20 rounded flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[#8c7a52] text-[8px] tracking-widest uppercase font-bold">Your Player ID</span>
                  <span className="text-white text-[10px] font-mono truncate max-w-[180px]">{auth.currentUser?.uid || 'GUEST'}</span>
                </div>
                <button 
                  onClick={handleShare}
                  className="bg-[#d9ad33] text-black px-3 py-1 rounded text-[10px] font-bold hover:bg-[#f5d666]"
                >
                  COPY
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Search by Player ID..."
                  className="flex-1 bg-white/5 border border-[#d9ad33]/30 rounded px-4 py-2 text-white focus:outline-none focus:border-[#d9ad33]"
                />
                <button 
                  onClick={startScanner}
                  className="bg-white/5 border border-[#d9ad33]/30 text-[#d9ad33] p-2 rounded hover:bg-white/10 transition-colors"
                  title="Scan QR"
                >
                  <Camera size={20} />
                </button>
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-[#d9ad33] text-black p-2 rounded hover:bg-[#f5d666] transition-colors"
                >
                  <Search size={20} />
                </button>
              </div>

              {searchResult && (
                <div 
                  className="bg-white/5 border border-[#d9ad33]/20 p-4 rounded mb-6 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all"
                  onClick={() => onViewProfile(searchResult.uid)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#d9ad33] overflow-hidden">
                      <img 
                        src={searchResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${searchResult.name}`} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-white font-bold">{searchResult.name}</div>
                      <div className="text-[#d9ad33] text-[10px]">RATING: {searchResult.rating || 0}</div>
                    </div>
                  </div>
                  <button 
                    onClick={handleAddFriend}
                    className="text-[10px] bg-[#d9ad33] text-black px-3 py-1 rounded font-bold hover:bg-[#f5d666]"
                  >
                    CHALLENGE
                  </button>
                </div>
              )}

              <div className="border-t border-white/10 pt-4">
                <div className="text-[#8c7a52] text-[10px] tracking-widest mb-2 uppercase font-bold">Friends & Allies</div>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {friends.length > 0 ? (
                    friends.map(friend => (
                      <div key={friend.uid} className="bg-white/5 p-2 rounded flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onViewProfile(friend.uid)}
                        >
                          <div className="w-8 h-8 rounded-full bg-[#d9ad33] overflow-hidden">
                            <img src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} alt="" />
                          </div>
                          <span className="text-white text-xs font-bold">{friend.name}</span>
                        </div>
                        <button 
                          onClick={() => onNavigate('Chat')}
                          className="text-[8px] bg-[#d9ad33] text-black px-2 py-1 rounded font-bold uppercase"
                        >
                          Chat
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/40 text-xs italic text-center py-4">No allies found in your court yet.</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#0f0a05] border-2 border-[#d9ad33] w-full max-w-sm p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col items-center max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button onClick={() => setShowQR(false)} className="absolute top-4 right-4 text-[#d9ad33]"><X size={24} /></button>
              <h2 className="text-2xl font-serif text-[#d9ad33] mb-2 tracking-widest text-center uppercase">MY CROWNS QR</h2>
              <p className="text-[#8c7a52] text-[10px] tracking-[0.2em] mb-8 uppercase font-bold">Scan to Challenge</p>
              
              <div ref={qrRef} className="bg-white p-4 rounded-xl mb-8 shadow-[0_0_50px_rgba(217,173,51,0.3)]">
                {user ? (
                  <QRCodeSVG 
                    value={user.uid} 
                    size={200}
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                      src: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerData.name}`,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-black font-bold">SIGN IN FIRST</div>
                )}
              </div>

              <div className="text-center mb-8">
                <div className="text-white font-bold tracking-widest mb-1 uppercase">{playerData.name}</div>
                <div className="text-[#d9ad33] text-xs font-mono">{user?.uid || 'GUEST'}</div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShare}
                  className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 shadow-lg"
                >
                  <Share2 size={18} />
                  SHARE INVITE
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadChallengeCard}
                  className="w-full py-3 bg-white/5 border border-[#d9ad33]/30 text-[#d9ad33] font-bold tracking-[0.2em] rounded-xl flex items-center justify-center gap-2"
                >
                  <Award size={18} />
                  DOWNLOAD CARD
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowQR(false);
                    startScanner();
                  }}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white/40 font-bold tracking-[0.2em] rounded-xl flex items-center justify-center gap-2"
                >
                  <Camera size={18} />
                  SCAN CHALLENGER
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Challenge Card for Generation */}
      <div className="fixed top-0 left-[-9999px] pointer-events-none" style={{ visibility: 'visible', zIndex: -1 }}>
        <div 
          ref={challengeCardRef}
          className="w-[400px] h-[600px] bg-[#030204] p-8 flex flex-col items-center justify-between border-4 border-[#d9ad33] relative overflow-hidden"
        >
          {/* Background Decorative Elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(217,173,51,0.2) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full" style={{ background: 'radial-gradient(circle, rgba(140,13,13,0.2) 0%, transparent 70%)' }} />
          
          <div className="flex flex-col items-center w-full">
            <h2 className="text-3xl font-serif text-[#d9ad33] tracking-[0.2em] mb-1 font-bold uppercase">CLASH OF CROWNS</h2>
            <div className="h-px w-32 bg-[rgba(217,173,51,0.5)] mb-8" />
            
            <div className="w-32 h-32 rounded-full p-1 shadow-[0_0_40px_rgba(217,173,51,0.3)] mb-6" style={{ background: 'linear-gradient(to bottom right, #d9ad33, #8c661a)' }}>
              <div className="w-full h-full rounded-full bg-[#0f0a05] flex items-center justify-center overflow-hidden border-2 border-[#000000]">
                <img 
                  src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerData.name}`} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-[#ffffff] tracking-widest mb-2 uppercase">{playerData.name}</h3>
            <div className="text-[#d9ad33] text-[10px] tracking-[0.4em] font-bold uppercase mb-8">CHALLENGER</div>
          </div>

          <div className="bg-[#ffffff] p-4 rounded-xl" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            {user && (
              <QRCodeSVG 
                value={user.uid} 
                size={180}
                level="H"
                includeMargin={true}
              />
            )}
          </div>

          <div className="flex flex-col items-center w-full mt-8">
            <div className="text-[#8c7a52] text-[8px] tracking-[0.3em] uppercase font-bold mb-1">Player ID</div>
            <div className="text-[#d9ad33] text-xs font-mono bg-[rgba(255,255,255,0.05)] px-4 py-1 rounded border border-[rgba(217,173,51,0.2)] mb-6">
              {user?.uid || 'GUEST'}
            </div>
            <div className="text-[rgba(255,255,255,0.6)] text-[10px] tracking-[0.2em] uppercase font-bold italic">
              "Rise from Cadet to Grandmaster"
            </div>
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
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
              className="relative bg-[#0f0a05] border-2 border-[#d9ad33] w-full max-w-md p-6 rounded-2xl shadow-2xl"
            >
              <button onClick={stopScanner} className="absolute top-4 right-4 text-[#d9ad33] z-10"><X size={24} /></button>
              <h2 className="text-xl font-serif text-[#d9ad33] mb-6 tracking-widest text-center">SCAN CHALLENGER</h2>
              
              <div id="qr-reader" className="overflow-hidden rounded-xl border border-[#d9ad33]/30 bg-black min-h-[300px]"></div>
              
              <p className="text-[#8c7a52] text-[10px] text-center mt-6 tracking-widest uppercase font-bold">
                Point your camera at a player's QR code
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 p-2 sm:p-4 rounded-xl flex flex-col items-center gap-0.5 sm:gap-1 group hover:bg-white/10 transition-colors">
      <span className="text-[8px] sm:text-[9px] text-[#8c7a52] font-bold tracking-widest uppercase truncate max-w-full">{label}</span>
      <span className="text-xs sm:text-base md:text-xl font-bold font-serif group-hover:scale-105 transition-transform" style={{ color }}>{value}</span>
    </div>
  );
}
