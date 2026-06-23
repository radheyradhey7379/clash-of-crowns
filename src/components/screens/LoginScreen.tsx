import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Crown, Play, User, LogIn, ShieldAlert } from 'lucide-react';
import { auth, googleProvider, db, isFirebaseConfigured } from '../../firebase';
import { signInWithPopup, signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { AppScreen } from '../../types';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);

  // Initialize FingerprintJS and check Firebase config on mount
  useEffect(() => {
    const setFp = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setVisitorId(result.visitorId);
    };
    setFp();

    if (!isFirebaseConfigured) {
      setError("Google login unavailable in this build. Guest mode only.");
    }
  }, []);

  const handleLoginLogic = async (user: any) => {
    if (!visitorId) return;

    try {
      // Track device ID in Firestore to prevent multi-account abuse/cheating
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        deviceId: visitorId,
        lastLogin: serverTimestamp(),
      }, { merge: true });

      onLoginSuccess();
    } catch (err) {
      console.error("Failed to sync device ID:", err);
      onLoginSuccess(); // Still proceed, but log error
    }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseConfigured) {
      setError("Google login unavailable in this build. Guest mode only.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // In native WebViews (Capacitor), signInWithPopup is blocked.
      const isNative = window.location.hostname === 'localhost' && 
        (navigator.userAgent.includes('Android') || navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'));
      
      if (isNative) {
        throw new Error("Google Sign In popups are unsupported in testing WebViews. Please choose 'Sign in as Guest' to play locally.");
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      await handleLoginLogic(result.user);
    } catch (err: any) {
      console.error("Google login failed:", err);
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setError("Google login needs Firebase Authorized Domain setup.");
      } else if (err.message && err.message.includes("popups are unsupported")) {
        setError(err.message);
      } else {
        setError("Google login unavailable in this build. Guest mode only.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isFirebaseConfigured) {
        try {
          console.log("Attempting Firebase Anonymous Auth for Guest session...");
          const result = await signInAnonymously(auth);
          await handleLoginLogic(result.user);
          return;
        } catch (authErr: any) {
          console.warn("Firebase Anonymous Auth failed, falling back to direct Firestore guest creation:", authErr);
          
          if (visitorId) {
            try {
              const guestUid = `guest_${visitorId}`;
              const userRef = doc(db, 'users', guestUid);
              await setDoc(userRef, {
                uid: guestUid,
                name: "Guest Player",
                createdAt: serverTimestamp(),
                deviceId: visitorId,
                lastLogin: serverTimestamp(),
                rating: 300,
                wins: 0,
                losses: 0,
                draws: 0,
                isPremium: false,
              }, { merge: true });
              console.log("Direct Firestore guest document created successfully!");
            } catch (fsErr) {
              console.warn("Direct Firestore guest creation failed:", fsErr);
            }
          }
        }
      }
      
      // Fallback: Bypass Firebase Auth for offline Guest Mode
      onLoginSuccess();
    } catch (err: any) {
      console.error("Guest login failed:", err);
      setError(`Failed to sign in as guest: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#030204] relative overflow-hidden p-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#d9ad33]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d9ad33]/5 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 grid grid-cols-1 landscape:grid-cols-[minmax(280px,0.85fr)_minmax(360px,1.15fr)] items-center justify-items-center gap-6 landscape:gap-16 max-w-md landscape:max-w-4xl w-full"
      >
        {/* Left Column: Branding */}
        <div className="flex flex-col items-center text-center landscape:items-start landscape:text-left">
          <div className="w-20 h-20 landscape:w-24 landscape:h-24 bg-gradient-to-br from-[#f5d666] to-[#d9ad33] rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(217,173,51,0.3)] mb-4 landscape:mb-8">
            <Crown className="text-[#030204] w-10 h-10 landscape:w-12 landscape:h-12" />
          </div>

          <h1 className="font-serif text-2xl landscape:text-3xl md:text-4xl text-[#f5d666] tracking-[0.2em] uppercase mb-1">
            Clash of Crowns
          </h1>
          <p className="text-[#524e48] font-serif tracking-widest uppercase text-[9px] landscape:text-xs mb-8 landscape:mb-0">
            The Ultimate Chess Conquest
          </p>
        </div>

        {/* Right Column: Actions */}
        <div className="w-full max-w-sm flex flex-col justify-center">
          <div className="w-full space-y-3 landscape:space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading || !isFirebaseConfigured}
              className={`w-full h-14 bg-[#1a1a1e] border border-[#323238] rounded-xl flex items-center px-6 transition-all group relative overflow-hidden ${!isFirebaseConfigured ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#f5d666]/50 cursor-pointer'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#f5d666]/0 via-[#f5d666]/5 to-[#f5d666]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-4">
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white text-sm font-medium">Sign in with Google Play</span>
                <span className="text-[#524e48] text-[10px] uppercase tracking-wider">Sync Progress & Achievements</span>
              </div>
              <LogIn size={18} className="ml-auto text-[#524e48] group-hover:text-[#f5d666] transition-colors" />
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="w-full h-14 bg-transparent border border-[#323238] hover:border-[#524e48] rounded-xl flex items-center px-6 transition-all group cursor-pointer"
            >
              <div className="w-8 h-8 bg-[#1a1a1e] rounded-full flex items-center justify-center mr-4">
                <User size={16} className="text-[#524e48]" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white text-sm font-medium">Sign in as Guest</span>
                <span className="text-[#524e48] text-[10px] uppercase tracking-wider">Local Progress Only</span>
              </div>
              <Play size={18} className="ml-auto text-[#524e48] group-hover:text-white transition-colors" />
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-red-400 text-[10px] landscape:text-xs text-center border border-red-500/20 bg-red-950/20 p-2.5 rounded-lg leading-normal uppercase tracking-wider font-medium"
            >
              {error}
            </motion.p>
          )}

          <div className="mt-8 landscape:mt-10 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#34A853] rounded flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                </svg>
              </div>
              <span className="text-[9px] text-[#524e48] uppercase tracking-widest font-bold">Google Play Games</span>
            </div>
            <div className="w-px h-4 bg-[#323238]" />
            <span className="text-[9px] text-[#524e48] uppercase tracking-widest font-bold">Secure Login</span>
          </div>
        </div>
      </motion.div>

      {isLoading && (
        <div className="absolute inset-0 bg-[#030204]/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-2 border-[#d9ad33]/20 border-t-[#d9ad33] rounded-full animate-spin mb-4" />
          <span className="text-[#f5d666] font-serif text-xs tracking-widest uppercase">Connecting...</span>
        </div>
      )}
    </div>
  );
}
