import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { loadPlayerData, savePlayerData, resetPlayerData, DEFAULT_PLAYER_DATA } from './lib/store';
import { AppScreen, PlayerData } from './types';
import SplashScreen from './components/screens/SplashScreen';
import LoginScreen from './components/screens/LoginScreen';
import HomeScreen from './components/screens/HomeScreen';
import LevelSelectScreen from './components/screens/LevelSelectScreen';
import GameScreen from './components/screens/GameScreen';
import StatsScreen from './components/screens/StatsScreen';
import SettingsScreen from './components/screens/SettingsScreen';
import AboutScreen from './components/screens/AboutScreen';
import RankScreen from './components/screens/RankScreen';
import LeaderboardScreen from './components/screens/LeaderboardScreen';
import ProfileScreen from './components/screens/ProfileScreen';
import LearnScreen from './components/screens/LearnScreen';
import ChatScreen from './components/screens/ChatScreen';
import PremiumScreen from './components/screens/PremiumScreen';
import CustomiseScreen from './components/screens/CustomiseScreen';
import TournamentScreen from './components/screens/TournamentScreen';
import HelpSupportScreen from './components/screens/HelpSupportScreen';
import YourDataScreen from './components/screens/YourDataScreen';
import PrivacyPolicyScreen from './components/screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './components/screens/TermsOfServiceScreen';
import BGMPlayer from './components/ui/BGMPlayer';
import ForceUpdateScreen from './components/screens/ForceUpdateScreen';
import MaintenanceScreen from './components/screens/MaintenanceScreen';
import SoftUpdateNotice from './components/ui/SoftUpdateNotice';
import { useVersionGate } from './lib/version/useVersionGate';
import { isCharacterUnlocked } from './game/ai/progressionEngine';
import { setNodeHealth, setRustHealth } from './lib/config/featureAvailability';
import { entitlementService } from './services/billing/entitlementService';
import { UserEntitlements } from './types/billingTypes';
import { DEFAULT_AI_PROGRESS } from './game/ai/aiProgressDefaults';

import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { syncUserProgress, updateUserStats } from './services/authService';
import { subscribeToNetworkChanges } from './lib/offline/networkStatus';
import {
  initializeSyncManager,
  registerLocalDataChangedListener,
  triggerDebouncedSync
} from './lib/cloud/cloudSyncManager';
import { uploadCloudSave } from './lib/cloud/cloudSaveService';

import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#030204] text-white p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-[#d9ad33]">Something went wrong</h1>
          <p className="text-white/60 mb-8">The application encountered an unexpected error.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-[#d9ad33] text-black font-bold rounded-full hover:bg-[#f5d666] transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { getSession, setSession, clearSession, ProfileType } from './lib/session';
import { initializeSessionLock, verifySessionLock, releaseSessionLock } from './services/sessionLock';

export default function App() {
  const { status: versionStatus, config: versionConfig, retry: retryVersionCheck, dismissSoftUpdate } = useVersionGate();
  const [screen, setScreen] = useState<AppScreen>('Splash');
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<PlayerData>(loadPlayerData());
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [localGameConfig, setLocalGameConfig] = useState<{ player1: string; player2: string; player1Color: 'w' | 'b' } | null>(null);
  const [multiplayerConfig, setMultiplayerConfig] = useState<{ roomId: string; role: 'host' | 'guest'; color: 'w' | 'b' } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDataSynced, setIsDataSynced] = useState(false);
  const [isLocalDataReady, setIsLocalDataReady] = useState(false);
  const [isCloudSyncReady, setIsCloudSyncReady] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(true);
  const [splashFinished, setSplashFinished] = useState(false);
  const [gameMenuTrigger, setGameMenuTrigger] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [rtt, setRtt] = useState<number | null>(null);
  const [performanceAlert, setPerformanceAlert] = useState(false);

  // Guest/user session persistence states
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [activeProfile, setActiveProfile] = useState<ProfileType>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Google Play Billing entitlements state
  const [entitlements, setEntitlements] = useState<UserEntitlements>({
    hasPremiumAnalysis: false,
    hasUndoAccess: false,
    premiumExpiresAt: null,
    undoExpiresAt: null
  });

  useEffect(() => {
    const unregister = entitlementService.registerListener((newEnts) => {
      setEntitlements(newEnts);
    });
    return () => unregister();
  }, []);

  // Initialize session from Capacitor Preferences on startup
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await getSession();
        setActiveProfile(session.activeProfileType);
        console.log("[App Session] Hydrated session:", session);
      } catch (err) {
        console.warn("[App Session] Failed to hydrate session:", err);
      } finally {
        setIsSessionHydrated(true);
      }
    };
    initSession();
  }, []);

  // Session Lock Verification Heartbeat
  useEffect(() => {
    if (!auth.currentUser || activeProfile !== 'user' || !isOnlineState) return;

    const interval = setInterval(async () => {
      const isValid = await verifySessionLock(auth.currentUser!.uid);
      if (!isValid) {
        setSessionExpired(true);
        await clearSession();
        await releaseSessionLock(auth.currentUser!.uid).catch(() => {});
        await signOut(auth).catch(() => {});
        setActiveProfile(null);
        setScreen('Login');
      }
    }, 60000); // Check every 60 seconds

    // Also run an immediate check on reconnect or when app becomes active
    const checkImmediate = async () => {
      if (auth.currentUser) {
        const isValid = await verifySessionLock(auth.currentUser.uid);
        if (!isValid) {
          setSessionExpired(true);
          await clearSession();
          await releaseSessionLock(auth.currentUser.uid).catch(() => {});
          await signOut(auth).catch(() => {});
          setActiveProfile(null);
          setScreen('Login');
        }
      }
    };
    checkImmediate();

    return () => clearInterval(interval);
  }, [auth.currentUser, activeProfile, isOnlineState]);

  // Performance Heartbeat (RTT tracking)
  useEffect(() => {
    if (screen === 'Splash' || !isAuthReady) return;

    const interval = setInterval(async () => {
      const start = Date.now();
      
      // Node Health
      try {
        const response = await fetch(getApiUrl('/api/health')); // Using health endpoint as heartbeat
        if (response.ok) {
          setNodeHealth('healthy');
          const end = Date.now();
          const latency = end - start;
          setRtt(latency);
          
          if (latency > 200) {
            setPerformanceAlert(true);
            setTimeout(() => setPerformanceAlert(false), 5000);
          } else {
            setPerformanceAlert(false);
          }
        } else {
          setNodeHealth('failed');
        }
      } catch (err) {
        console.warn("Node heartbeat failed", err);
        setNodeHealth('failed');
      }

      // Rust Health
      try {
        const rustUrl = import.meta.env?.VITE_REALTIME_HTTP_URL || 'http://localhost:3001';
        const response = await fetch(`${rustUrl}/health`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.status === 'ok') {
            setRustHealth('healthy');
          } else {
            setRustHealth('failed');
          }
        } else {
          setRustHealth('failed');
        }
      } catch (err) {
        console.warn("Rust heartbeat failed", err);
        setRustHealth('failed');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [screen, isAuthReady]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 1024;
      setIsMobile(hasTouch && isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Preload 3D board safely after startup
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./components/game/ChessBoard3D').catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Hide StatusBar on native platform
  useEffect(() => {
    const setupMobileFullscreen = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.hide();
        } catch (err) {
          console.warn('Failed to hide status bar:', err);
        }
      }
    };
    setupMobileFullscreen();
  }, []);

  // Handle native Android Back Button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      console.log("Native backButton pressed, canGoBack:", canGoBack);
      if (screen === 'Game') {
        // Trigger game menu overlay inside GameScreen by incrementing the menu trigger counter
        setGameMenuTrigger(prev => prev + 1);
      } else if (screen === 'Home' || screen === 'Login') {
        // Exit the app from main entry pages
        CapApp.exitApp();
      } else {
        // Navigate back to Home from settings, profile, customize, stats, etc.
        handleNavigate('Home');
      }
    });

    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, [screen]);

  // Subscribe to network connectivity changes
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setIsOnlineState(online);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Cloud Sync Manager and register React state updater
  useEffect(() => {
    initializeSyncManager();
    registerLocalDataChangedListener((newData) => {
      setPlayerData(newData);
    });
  }, []);

  // Sync with Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Sync session preferences
          await setSession('user', user.uid);
          setActiveProfile('user');
          await initializeSessionLock(user.uid);
          
          // Start real-time billing entitlements listener
          entitlementService.startListening(user.uid);
          
          // Check for Stripe success
          const urlParams = new URLSearchParams(window.location.search);
          const paymentStatus = urlParams.get('payment');
          
          try {
            const syncedData = await syncUserProgress(user, playerData);
            setPlayerData(syncedData);
            savePlayerData(syncedData);
            setIsCloudSyncReady(true);
            setIsDataSynced(true);
          } catch (syncErr) {
            console.warn("Failed to sync user progress, running offline:", syncErr);
            setIsCloudSyncReady(false);
            setIsDataSynced(true); // Allow local progress save
            const updated = { ...playerData, uid: user.uid, name: user.displayName || playerData.name };
            setPlayerData(updated);
            savePlayerData(updated);
          }
          
          if (paymentStatus === 'success') {
            try {
              await updateDoc(doc(db, 'users', user.uid), { isPremium: true });
              handleUpdatePlayerData({ isPremium: true });
              window.history.replaceState({}, document.title, "/");
            } catch (premiumErr) {
              console.warn("Failed to update premium flag in cloud:", premiumErr);
            }
          }
        } else {
          console.log("No user signed in onAuthStateChanged.");
          setIsCloudSyncReady(false);
          setIsDataSynced(true);
          
          // Stop real-time billing entitlements listener
          entitlementService.stopListening();
          
          // If we had a active 'user' profile but Firebase says we are signed out, clear the session.
          // If it was 'guest', we keep it as guest!
          if (activeProfile === 'user') {
            await clearSession();
            setActiveProfile(null);
          }
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged handler:", err);
      } finally {
        setIsAuthReady(true);
        setIsLocalDataReady(true);
      }
    });
    return () => unsubscribe();
  }, [activeProfile]);

  // Sync Firestore changes back to local state
  useEffect(() => {
    if (!auth.currentUser || !isAuthReady || !isDataSynced || !isOnlineState || !isCloudSyncReady) return;
    
    const uid = auth.currentUser.uid;
    try {
      const unsubscribe = onSnapshot(doc(db, 'users', uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setPlayerData(prev => ({ ...prev, ...data }));
        }
      }, (error) => {
        console.warn("User data listener error:", error.message);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn("User data snapshot listener creation failed:", err);
    }
  }, [isAuthReady, isDataSynced, auth.currentUser, isOnlineState, isCloudSyncReady]);

  useEffect(() => {
    savePlayerData(playerData);
    // Apply font size to root html element
    document.documentElement.style.fontSize = `${(playerData.fontSize || 1) * 16}px`;
    // Trigger debounced cloud synchronization in background
    triggerDebouncedSync();
  }, [playerData]);

  // Session-aware Splash Routing loading gate
  useEffect(() => {
    if (isLocalDataReady && splashFinished && isSessionHydrated && isAuthReady && screen === 'Splash') {
      if (activeProfile === 'user' && auth.currentUser) {
        setScreen('Home');
      } else if (activeProfile === 'guest') {
        setScreen('Home');
      } else {
        setScreen('Login');
      }
    }
  }, [isLocalDataReady, splashFinished, isSessionHydrated, isAuthReady, activeProfile, screen]);

  const handleNavigate = (newScreen: AppScreen, characterId: string | null = null, localConfig: any = null, multiConfig: any = null) => {
    if (newScreen === 'Home') {
      setSelectedCharacterId(null);
      setLocalGameConfig(null);
      setMultiplayerConfig(null);
      setViewingProfileUid(null);
    } else if (newScreen === 'Game') {
      if (characterId) {
        const isUnlocked = isCharacterUnlocked(characterId, playerData.aiProgress);
        if (!isUnlocked) {
          console.warn(`Direct route guard blocked navigation to locked character: ${characterId}`);
          return;
        }
      }
      setSelectedCharacterId(characterId);
      setLocalGameConfig(localConfig);
      setMultiplayerConfig(multiConfig);
    } else if (newScreen !== 'Profile') {
      setViewingProfileUid(null);
    }
    setScreen(newScreen);
  };

  const resetStatsOnly = async () => {
    localStorage.setItem("clash_reset_marker_at", Date.now().toString());
    const resetTime = new Date().toISOString();

    setPlayerData(prev => {
      const updated = {
        ...prev,
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        bestStreak: 0,
        whiteWins: 0,
        whiteLosses: 0,
        whiteDraws: 0,
        whiteGames: 0,
        blackWins: 0,
        blackLosses: 0,
        blackDraws: 0,
        blackGames: 0,
        whiteTime: 0,
        blackTime: 0,
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        lastResetAt: resetTime
      };
      savePlayerData(updated);
      return updated;
    });

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      const userRef = doc(db, 'users', uid);
      try {
        await updateDoc(userRef, {
          wins: 0,
          losses: 0,
          draws: 0,
          streak: 0,
          bestStreak: 0,
          whiteWins: 0,
          whiteLosses: 0,
          whiteDraws: 0,
          whiteGames: 0,
          blackWins: 0,
          blackLosses: 0,
          blackDraws: 0,
          blackGames: 0,
          whiteTime: 0,
          blackTime: 0,
          lastResetAt: resetTime,
          lastActive: new Date().toISOString()
        });

        // Instantly push to cloudSaves to sync DB
        const currentData = loadPlayerData();
        await uploadCloudSave(uid, currentData);
      } catch (err) {
        console.error("Failed to reset Firestore stats:", err);
      }
    }
  };

  const resetProgressOnly = async () => {
    localStorage.setItem("clash_reset_marker_at", Date.now().toString());
    localStorage.removeItem("clash_cup_round_robin_state");
    const resetTime = new Date().toISOString();

    setPlayerData(prev => {
      const updated = {
        ...prev,
        rating: 0,
        tier: 0,
        char: 0,
        consecLoss: 0,
        aiProgress: DEFAULT_AI_PROGRESS,
        coins: 0,
        xp: 0,
        badges: [],
        arenaRating: 1200,
        appliedArenaResultIds: [],
        lastResetAt: resetTime
      };
      savePlayerData(updated);
      return updated;
    });

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      const userRef = doc(db, 'users', uid);
      try {
        await updateDoc(userRef, {
          rating: 0,
          tier: 0,
          char: 0,
          consecLoss: 0,
          aiProgress: DEFAULT_AI_PROGRESS,
          coins: 0,
          xp: 0,
          badges: [],
          arenaRating: 1200,
          appliedArenaResultIds: [],
          lastResetAt: resetTime,
          lastActive: new Date().toISOString()
        });

        // Instantly push to cloudSaves to sync DB
        const currentData = loadPlayerData();
        await uploadCloudSave(uid, currentData);
      } catch (err) {
        console.error("Failed to reset Firestore progress:", err);
      }
    }
  };

  const deleteAllMyDataAndLogout = async () => {
    await clearSession();
    if (auth.currentUser) {
      try {
        await releaseSessionLock(auth.currentUser.uid).catch(() => {});
        await signOut(auth).catch(() => {});
      } catch (e) {
        console.error("Sign out failed:", e);
      }
    }
    if (activeProfile === 'guest') {
      await clearGuestSessionProgress();
    }
    setActiveProfile(null);
    const resetData = resetPlayerData();
    setPlayerData(resetData);
    setSelectedCharacterId(null);
    setLocalGameConfig(null);
    setMultiplayerConfig(null);
    setViewingProfileUid(null);
    localStorage.removeItem("clash_of_crowns_saved_game");

    setScreen('Login');
  };

  const performFullLogout = async () => {
    try {
      if (auth.currentUser) {
        if (isOnlineState) {
          await releaseSessionLock(auth.currentUser.uid).catch(() => {});
        }
        await signOut(auth).catch(() => {});
      }
      await clearSession();
      if (activeProfile === 'guest') {
        await clearGuestSessionProgress();
      }
      
      setActiveProfile(null);
      const resetData = resetPlayerData();
      setPlayerData(resetData);
      setSelectedCharacterId(null);
      setLocalGameConfig(null);
      setMultiplayerConfig(null);
      setViewingProfileUid(null);
      
      setScreen('Login');
    } catch (e) {
      console.error("Error during performFullLogout:", e);
      setScreen('Login');
    }
  };

  const handleDataDeleted = async () => {
    await deleteAllMyDataAndLogout();
  };

  const handleUpdatePlayerData = (newData: Partial<PlayerData>) => {
    setPlayerData(prev => {
      const updated = { ...prev, ...newData };
      savePlayerData(updated);
      return updated;
    });
  };

  // Sync to Firestore when local state changes
  useEffect(() => {
    if (!auth.currentUser || !isAuthReady || !isDataSynced || !isOnlineState || !isCloudSyncReady) return;
    
    const syncData = {
      name: playerData.name,
      tier: playerData.tier,
      char: playerData.char,
      rating: playerData.rating,
      wins: playerData.wins,
      losses: playerData.losses,
      draws: playerData.draws,
      streak: playerData.streak,
      bestStreak: playerData.bestStreak,
      photoURL: playerData.photoURL || auth.currentUser.photoURL || "",
      selectedPieceSet: playerData.selectedPieceSet,
      boardTheme: playerData.boardTheme,
      homeAnimation: playerData.homeAnimation,
      whiteGames: playerData.whiteGames,
      whiteWins: playerData.whiteWins,
      whiteLosses: playerData.whiteLosses,
      whiteDraws: playerData.whiteDraws,
      blackGames: playerData.blackGames,
      blackWins: playerData.blackWins,
      blackLosses: playerData.blackLosses,
      blackDraws: playerData.blackDraws,
      coins: playerData.coins,
      xp: playerData.xp,
      badges: playerData.badges,
      aiProgress: playerData.aiProgress,
      viewMode: playerData.viewMode || '3d',
      lastActive: new Date().toISOString()
    };
    
    updateUserStats(auth.currentUser.uid, syncData).catch(err => {
      console.warn("Firestore sync deferred or failed:", err.message);
    });
  }, [
    playerData.name, 
    playerData.tier, 
    playerData.char, 
    playerData.rating,
    playerData.wins,
    playerData.losses,
    playerData.draws,
    playerData.streak,
    playerData.bestStreak,
    playerData.photoURL, 
    playerData.selectedPieceSet,
    playerData.boardTheme,
    playerData.homeAnimation,
    playerData.whiteGames,
    playerData.whiteWins,
    playerData.whiteLosses,
    playerData.whiteDraws,
    playerData.blackGames,
    playerData.blackWins,
    playerData.blackLosses,
    playerData.blackDraws,
    playerData.coins,
    playerData.xp,
    playerData.viewMode,
    JSON.stringify(playerData.badges || []),
    JSON.stringify(playerData.aiProgress || {}),
    isAuthReady,
    isDataSynced,
    isOnlineState,
    isCloudSyncReady
  ]);

  const renderScreen = () => {
    // Version Gate Blocking Screens
    if (versionStatus === 'force_update') {
      return <ForceUpdateScreen config={versionConfig} />;
    }
    if (versionStatus === 'maintenance') {
      return <MaintenanceScreen config={versionConfig} onRetry={retryVersionCheck} />;
    }

    // Unified initialization splash screen
    const isAppInitializing = versionStatus === 'checking' || !isSessionHydrated || !isAuthReady || !splashFinished;
    if (isAppInitializing) {
      return <SplashScreen onFinish={() => setSplashFinished(true)} />;
    }

    // Session Guard: If no session profile is active, restrict access to home/gameplay screens
    const allowedWithoutSession = ['Splash', 'Login', 'PrivacyPolicy', 'TermsOfService'];
    if (!activeProfile && !allowedWithoutSession.includes(screen)) {
      console.warn(`[Session Guard] Blocked screen '${screen}' because activeProfile is null.`);
      return (
        <LoginScreen 
          onLoginSuccess={async () => {
            const session = await getSession();
            setActiveProfile(session.activeProfileType);
            handleNavigate('Home');
          }} 
        />
      );
    }

    console.log(`Rendering screen: ${screen}`);
    switch (screen) {
      case 'Splash':
        return <SplashScreen onFinish={() => setSplashFinished(true)} />;
      case 'Login':
        return (
          <LoginScreen 
            onLoginSuccess={async () => {
              const session = await getSession();
              setActiveProfile(session.activeProfileType);
              handleNavigate('Home');
            }} 
          />
        );
      case 'Home':
        return (
          <HomeScreen 
            onNavigate={handleNavigate} 
            playerData={playerData} 
            entitlements={entitlements}
          />
        );
      case 'LevelSelect':
        return (
          <LevelSelectScreen
            onNavigate={handleNavigate}
            playerData={playerData}
            onSelectLevel={(characterId) => {
              handleNavigate('Game', characterId);
            }}
          />
        );
      case 'Game':
        return (
          <GameScreen
            key={selectedCharacterId || 'local-vs'}
            onNavigate={handleNavigate}
            playerData={playerData}
            selectedCharacterId={selectedCharacterId}
            localGameConfig={localGameConfig}
            multiplayerConfig={multiplayerConfig}
            onUpdatePlayerData={handleUpdatePlayerData}
            forceOpenMenu={gameMenuTrigger}
            entitlements={entitlements}
          />
        );
      case 'Stats':
        return <StatsScreen onNavigate={handleNavigate} playerData={playerData} onReset={resetStatsOnly} />;
      case 'Settings':
        return <SettingsScreen onNavigate={handleNavigate} playerData={playerData} onUpdate={handleUpdatePlayerData} />;
      case 'About':
        return <AboutScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'HelpSupport':
        return <HelpSupportScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'YourData':
        return (
          <YourDataScreen 
            onNavigate={handleNavigate} 
            playerData={playerData} 
            onDataDeleted={handleDataDeleted} 
            onResetStats={resetStatsOnly}
            onResetProgress={resetProgressOnly}
          />
        );
      case 'PrivacyPolicy':
        return <PrivacyPolicyScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'TermsOfService':
        return <TermsOfServiceScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'Rank':
        return <RankScreen onNavigate={handleNavigate} playerData={playerData} onReset={resetStatsOnly} />;
      case 'Leaderboard':
        return <LeaderboardScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'Profile':
        return <ProfileScreen 
          onNavigate={handleNavigate} 
          playerData={playerData} 
          onUpdate={handleUpdatePlayerData}
          viewingUid={viewingProfileUid}
          onViewProfile={setViewingProfileUid}
          onLogout={performFullLogout}
          entitlements={entitlements}
        />;
      case 'Chat':
        return <ChatScreen 
          onNavigate={handleNavigate} 
          playerData={playerData}
          onViewProfile={setViewingProfileUid}
        />;
      case 'Learn':
        return <LearnScreen onNavigate={handleNavigate} playerData={playerData} />;
      case 'Premium':
        return <PremiumScreen onNavigate={handleNavigate} playerData={playerData} entitlements={entitlements} />;
      case 'Customise':
        return <CustomiseScreen onNavigate={handleNavigate} playerData={playerData} onUpdatePlayerData={handleUpdatePlayerData} />;
      case 'Tournament':
        return <TournamentScreen onNavigate={handleNavigate} playerData={playerData} />;
      default:
        return <HomeScreen onNavigate={handleNavigate} playerData={playerData} entitlements={entitlements} />;
    }
  };

  const isRtl = playerData.language === 'ur' || playerData.language === 'ar';

  return (
    <div 
      className="fixed inset-0 bg-[#030204] text-white overflow-hidden font-sans select-none" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Edge Swipe Detectors for Mobile Back Navigation */}
      {isMobile && screen !== 'Splash' && (
        <>
          {/* Left Edge -> Swipe Right */}
          <motion.div
            className="fixed top-0 left-0 bottom-0 w-12 z-[100] cursor-pointer"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x > 80) {
                if (screen === 'Game') {
                  setGameMenuTrigger(prev => prev + 1);
                } else if (screen !== 'Home') {
                  handleNavigate('Home');
                }
              }
            }}
          />
          {/* Right Edge -> Swipe Left */}
          <motion.div
            className="fixed top-0 right-0 bottom-0 w-12 z-[100] cursor-pointer"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) {
                if (screen === 'Game') {
                  setGameMenuTrigger(prev => prev + 1);
                } else if (screen !== 'Home') {
                  handleNavigate('Home');
                }
              }
            }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full h-full"
        >
          <ErrorBoundary>
            {renderScreen()}
          </ErrorBoundary>

          {/* Soft Update Notice */}
          {versionStatus === 'soft_update' && (
            <SoftUpdateNotice config={versionConfig} onDismiss={dismissSoftUpdate} />
          )}


        </motion.div>
      </AnimatePresence>

      <BGMPlayer musicOn={playerData.musicOn} currentScreen={screen} />

      {/* Session Expired Overlay */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <div className="bg-[#110e14] border border-[#d9ad33]/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-[#d9ad33]/10">
            <div className="w-16 h-16 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <LogOut size={32} />
            </div>
            <h2 className="text-xl font-extrabold text-[#d9ad33] tracking-wider mb-4">SESSION EXPIRED</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8">
              Your account was opened on another device. Please login again to continue.
            </p>
            <button
              onClick={() => {
                setSessionExpired(false);
                setScreen('Login');
              }}
              className="w-full py-3 bg-[#d9ad33] hover:bg-[#f5d666] text-black font-extrabold rounded-xl transition-all tracking-widest text-xs uppercase shadow-lg shadow-[#d9ad33]/20"
            >
              Login Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
