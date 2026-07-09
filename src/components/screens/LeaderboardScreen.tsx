import React, { useState, useEffect, useRef } from 'react';
import ScreenBackground from '../ui/ScreenBackground';
import { motion, AnimatePresence } from 'motion/react';
import { AppScreen, PlayerData, TIER_LABELS, TIER_COLORS, TIER_KEYS } from '../../types';
import { ChevronLeft, Trophy, Download, Zap, X, Swords } from 'lucide-react';
import { cn, downloadElement } from '../../lib/utils';
import { getTopCompKings, getMyCompRank } from '../../game/leaderboard/compLeaderboardService';
import { getTopArenaKings, getMyArenaRank } from '../../game/leaderboard/arenaLeaderboardService';
import { LeaderboardEntry } from '../../game/leaderboard/leaderboardTypes';
import { sendPokeChallenge } from '../../game/social/challengeService';
import { isChallengeMatchEnabled, isSocialPokeEnabled, getDisabledFeatureMessage } from '../../lib/config/featureFlags';
import { isOnline, subscribeToNetworkChanges } from '../../lib/offline/networkStatus';

const MOCK_COMP_ENTRIES: LeaderboardEntry[] = [
  {
    uid: "mock_ai_1",
    displayName: "Magnus Bot",
    mode: "comp_kings",
    score: 2850,
    updatedAt: Date.now(),
    compStats: { compElo: 2850, compTier: "grandmaster", compWins: 540, compMatches: 600, compWinStreak: 25, completedMasterCups: 5, grandmasterDefeated: true }
  },
  {
    uid: "mock_ai_2",
    displayName: "Hikaru AI",
    mode: "comp_kings",
    score: 2820,
    updatedAt: Date.now(),
    compStats: { compElo: 2820, compTier: "grandmaster", compWins: 510, compMatches: 580, compWinStreak: 12, completedMasterCups: 4, grandmasterDefeated: true }
  },
  {
    uid: "mock_ai_3",
    displayName: "Kasparov Bot",
    mode: "comp_kings",
    score: 2800,
    updatedAt: Date.now(),
    compStats: { compElo: 2800, compTier: "grandmaster", compWins: 490, compMatches: 550, compWinStreak: 8, completedMasterCups: 3, grandmasterDefeated: true }
  },
  {
    uid: "mock_ai_4",
    displayName: "Stockfish Lite",
    mode: "comp_kings",
    score: 2750,
    updatedAt: Date.now(),
    compStats: { compElo: 2750, compTier: "master", compWins: 450, compMatches: 520, compWinStreak: 5, completedMasterCups: 2, grandmasterDefeated: true }
  },
  {
    uid: "mock_ai_5",
    displayName: "Master-Chef",
    mode: "comp_kings",
    score: 2400,
    updatedAt: Date.now(),
    compStats: { compElo: 2400, compTier: "master", compWins: 320, compMatches: 410, compWinStreak: 4, completedMasterCups: 1, grandmasterDefeated: false }
  }
];

const MOCK_ARENA_ENTRIES: LeaderboardEntry[] = [
  {
    uid: "mock_player_1",
    displayName: "PawnCrusher",
    mode: "arena_kings",
    score: 2100,
    updatedAt: Date.now(),
    arenaStats: { arenaRating: 2100, arenaWins: 120, arenaLosses: 30, arenaDraws: 10, arenaWinRate: 75, arenaMatches: 160 }
  },
  {
    uid: "mock_player_2",
    displayName: "CastleKnight",
    mode: "arena_kings",
    score: 1950,
    updatedAt: Date.now(),
    arenaStats: { arenaRating: 1950, arenaWins: 95, arenaLosses: 35, arenaDraws: 15, arenaWinRate: 65, arenaMatches: 145 }
  },
  {
    uid: "mock_player_3",
    displayName: "QueenGambiteer",
    mode: "arena_kings",
    score: 1800,
    updatedAt: Date.now(),
    arenaStats: { arenaRating: 1800, arenaWins: 80, arenaLosses: 40, arenaDraws: 20, arenaWinRate: 57, arenaMatches: 140 }
  },
  {
    uid: "mock_player_4",
    displayName: "DoubleCheck",
    mode: "arena_kings",
    score: 1650,
    updatedAt: Date.now(),
    arenaStats: { arenaRating: 1650, arenaWins: 65, arenaLosses: 45, arenaDraws: 15, arenaWinRate: 52, arenaMatches: 125 }
  },
  {
    uid: "mock_player_5",
    displayName: "RookRider",
    mode: "arena_kings",
    score: 1500,
    updatedAt: Date.now(),
    arenaStats: { arenaRating: 1500, arenaWins: 50, arenaLosses: 50, arenaDraws: 10, arenaWinRate: 45, arenaMatches: 110 }
  }
];

export default function LeaderboardScreen({ onNavigate, playerData }: { onNavigate: (screen: AppScreen) => void, playerData: PlayerData }) {
  const [activeTab, setActiveTab] = useState(0); // 0 = Comp Kings, 1 = Arena Kings
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const leaderboardRef = useRef<HTMLDivElement>(null);

  // Challenge modal state
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const [challengeType, setChallengeType] = useState<'poke' | 'challenge'>('poke');
  const [challengeMsg, setChallengeMsg] = useState('');
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Connectivity & manual retry state
  const [isDeviceOnline, setIsDeviceOnline] = useState(isOnline());
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setIsDeviceOnline(online);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchData() {
      setLoading(true);
      setErrorMsg(null);
      
      const compCacheKey = 'coc_cached_leaderboard_comp';
      const arenaCacheKey = 'coc_cached_leaderboard_arena';
      const myCompRankKey = 'coc_cached_my_comp_rank';
      const myArenaRankKey = 'coc_cached_my_arena_rank';

      try {
        if (isDeviceOnline) {
          if (activeTab === 0) {
            const fetchedEntries = await getTopCompKings(20);
            if (active) {
              setEntries(fetchedEntries);
              localStorage.setItem(compCacheKey, JSON.stringify(fetchedEntries));
              if (playerData.uid) {
                const rank = await getMyCompRank(playerData.uid);
                setMyRank(rank);
                localStorage.setItem(myCompRankKey, rank.toString());
              }
            }
          } else {
            const fetchedEntries = await getTopArenaKings(20);
            if (active) {
              setEntries(fetchedEntries);
              localStorage.setItem(arenaCacheKey, JSON.stringify(fetchedEntries));
              if (playerData.uid) {
                const rank = await getMyArenaRank(playerData.uid);
                setMyRank(rank);
                localStorage.setItem(myArenaRankKey, rank.toString());
              }
            }
          }
        } else {
          // Device is offline, try to load from localStorage cache
          const cachedJson = localStorage.getItem(activeTab === 0 ? compCacheKey : arenaCacheKey);
          if (cachedJson) {
            const parsed = JSON.parse(cachedJson);
            if (active) {
              setEntries(parsed);
              const cachedMyRank = localStorage.getItem(activeTab === 0 ? myCompRankKey : myArenaRankKey);
              setMyRank(cachedMyRank ? parseInt(cachedMyRank, 10) : -1);
            }
          } else {
            // No cache found, load fallback mock data
            if (active) {
              setEntries(activeTab === 0 ? MOCK_COMP_ENTRIES : MOCK_ARENA_ENTRIES);
              setMyRank(-1);
            }
          }
        }
      } catch (err) {
        if (active) {
          console.warn('[LeaderboardScreen] Fetch error, trying cache/mock fallback:', err);
          // Try loading from cache on error
          const cachedJson = localStorage.getItem(activeTab === 0 ? compCacheKey : arenaCacheKey);
          if (cachedJson) {
            const parsed = JSON.parse(cachedJson);
            setEntries(parsed);
            const cachedMyRank = localStorage.getItem(activeTab === 0 ? myCompRankKey : myArenaRankKey);
            setMyRank(cachedMyRank ? parseInt(cachedMyRank, 10) : -1);
          } else {
            // Mock fallback
            setEntries(activeTab === 0 ? MOCK_COMP_ENTRIES : MOCK_ARENA_ENTRIES);
            setMyRank(-1);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      active = false;
    };
  }, [activeTab, playerData.uid, isDeviceOnline, retryTrigger]);

  const handleActionClick = (player: LeaderboardEntry) => {
    if (!playerData.uid) {
      setActionStatus({ type: 'error', text: 'Sign in to poke or challenge players!' });
      setTimeout(() => setActionStatus(null), 2000);
      return;
    }
    setSelectedPlayer(player);
    setChallengeType('poke');
    setChallengeMsg('');
    setActionStatus(null);
  };

  const handleSendRequest = async () => {
    if (!selectedPlayer || !playerData.uid) return;
    setSubmitting(true);
    setActionStatus(null);

    const fromMode = activeTab === 0 ? 'comp_kings' : 'arena_kings';
    const fromRank = myRank > 0 ? myRank : undefined;

    const res = await sendPokeChallenge(
      selectedPlayer.uid,
      selectedPlayer.displayName,
      challengeType,
      fromMode,
      fromRank,
      challengeType === 'challenge' ? challengeMsg : undefined
    );

    setSubmitting(false);

    if (res.success) {
      setActionStatus({ type: 'success', text: `Sent ${challengeType} successfully!` });
      setTimeout(() => {
        setSelectedPlayer(null);
        setActionStatus(null);
      }, 1500);
    } else {
      setActionStatus({ type: 'error', text: res.reason || 'Failed to send request' });
    }
  };

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
          <Trophy size={24} className="text-[#d9ad33]" />
          <div className="flex flex-col items-start">
            <h1 className="text-2xl font-bold text-[#d9ad33] tracking-[0.3em] font-serif uppercase">LEADERBOARD</h1>
            {!isDeviceOnline && (
              <span className="text-[7px] font-black tracking-widest text-orange-400 uppercase bg-orange-500/10 border border-orange-500/25 px-2 py-0.5 rounded-full mt-1.5 animate-pulse">Offline Mode</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              if (leaderboardRef.current) {
                downloadElement(leaderboardRef.current, `clash-of-crowns-leaderboard.png`);
              }
            }}
            className="p-2 bg-black/40 border border-[#d9ad33]/20 rounded-full text-[#d9ad33] hover:bg-[#d9ad33]/10 transition-all shadow-[0_0_10px_rgba(217,173,51,0.2)]"
            title="Download Leaderboard"
          >
            <Download size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('Rank')}
            className="bg-white/5 backdrop-blur-md text-[#d9ad33] px-6 py-2 text-xs font-bold tracking-widest border border-white/10 rounded-full hover:bg-white/10 transition-all"
          >
            RANK PAGE
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex h-12 bg-black/40 backdrop-blur-md border-b border-white/5 z-10">
        {["Comp Kings", "Arena Kings"].map((tab, i) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(i);
            }}
            className={cn(
              "flex-1 font-bold text-[10px] tracking-[0.3em] transition-all relative uppercase",
              activeTab === i ? "text-[#d9ad33] bg-white/5" : "text-white/20 hover:text-white/40"
            )}
          >
            {tab}
            {activeTab === i && <motion.div layoutId="lb-tab" className="absolute bottom-0 left-0 w-full h-0.5 bg-[#d9ad33]" />}
          </button>
        ))}
      </div>

      {/* Arena Disclaimer Message */}
      {activeTab === 1 && (
        <div className="px-8 pt-4 z-10">
          <div className="text-center py-2 px-4 rounded-xl bg-[#d9ad33]/10 border border-[#d9ad33]/20 text-[#d9ad33] text-[9px] font-bold tracking-widest uppercase max-w-xl mx-auto">
            Arena ranking will activate with ranked multiplayer
          </div>
        </div>
      )}

      {/* Headers */}
      <div className="flex px-8 py-3 bg-black/20 backdrop-blur-sm border-b border-white/5 text-[9px] font-bold text-[#8c7a52] tracking-[0.3em] z-10 uppercase">
        <div className="w-12 text-center">#</div>
        <div className="flex-1 ml-4">Player</div>
        <div className="w-32 text-center">{activeTab === 0 ? "Tier" : "W / L / D"}</div>
        <div className="w-24 text-center">{activeTab === 0 ? "Comp ELO" : "Rating"}</div>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-white/40 font-bold text-sm tracking-widest uppercase animate-pulse z-10">
          Loading Leaderboard...
        </div>
      )}

      {!loading && errorMsg && (
        <div className="flex-1 flex flex-col items-center justify-center text-white/30 font-bold text-sm tracking-widest uppercase text-center p-8 z-10 gap-4">
          <Trophy size={48} className="text-white/10 mb-2" />
          <div>{errorMsg}</div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setRetryTrigger(prev => prev + 1)}
            className="px-6 py-2.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black font-bold tracking-widest text-xs uppercase rounded-xl shadow-lg transition-all"
          >
            Retry
          </motion.button>
        </div>
      )}

      {/* List */}
      {!loading && !errorMsg && (
        <div className="flex-1 overflow-y-auto z-10 px-4 py-2 custom-scrollbar">
          <div ref={leaderboardRef} className="max-w-5xl mx-auto flex flex-col gap-2 p-4 rounded-3xl bg-black/20">
            {entries.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-xs font-bold uppercase tracking-widest">
                No entries found
              </div>
            ) : (
              entries.map((player, i) => {
                let badgeOrGmIndicator = null;
                if (activeTab === 0 && player.compStats?.grandmasterDefeated) {
                  badgeOrGmIndicator = <span className="ml-2 text-[9px] font-bold bg-[#d9ad33]/20 text-[#d9ad33] border border-[#d9ad33]/40 px-1.5 py-0.5 rounded" title="Grandmaster Defeated">GM DEFEATED</span>;
                }

                const tierKeyIndex = activeTab === 0 && player.compStats?.compTier 
                  ? TIER_KEYS.indexOf(player.compStats.compTier) 
                  : 0;
                const tierColor = TIER_COLORS[tierKeyIndex >= 0 ? tierKeyIndex : 0];
                const tierLabel = TIER_LABELS[tierKeyIndex >= 0 ? tierKeyIndex : 0];

                return (
                  <motion.div 
                    key={player.uid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "flex items-center px-4 h-14 rounded-xl border border-white/5 transition-all hover:bg-white/5",
                      i === 0 ? "bg-gradient-to-r from-[#d9ad33]/10 to-transparent border-[#d9ad33]/20" : 
                      i === 1 ? "bg-gradient-to-r from-slate-400/10 to-transparent border-slate-400/20" : 
                      i === 2 ? "bg-gradient-to-r from-amber-700/10 to-transparent border-amber-700/20" : 
                      "bg-white/5"
                    )}
                  >
                    <div className="w-12 flex justify-center">
                      {i < 3 ? (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-black font-bold",
                          i === 0 ? "bg-[#d9ad33]" : i === 1 ? "bg-[#c0c0c0]" : "bg-[#cd7f32]"
                        )}>
                          {i + 1}
                        </div>
                      ) : (
                        <span className="text-white/20 font-bold text-sm">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 ml-4 font-bold text-white tracking-wide flex items-center">
                      {player.displayName}
                      {badgeOrGmIndicator}
                    </div>
                    <div className="w-32 text-center text-[9px] font-bold tracking-widest uppercase">
                      {activeTab === 0 ? (
                        <span style={{ color: tierColor }}>{tierLabel}</span>
                      ) : (
                        <span className="text-white/40">
                          {player.arenaStats 
                            ? `${player.arenaStats.arenaWins}W / ${player.arenaStats.arenaLosses}L / ${player.arenaStats.arenaDraws}D`
                            : '0W / 0L / 0D'}
                        </span>
                      )}
                    </div>
                    <div className="w-24 text-center font-bold text-[#d9ad33] font-serif flex items-center justify-center">
                      {activeTab === 0 ? (player.compStats?.compElo ?? 1200) : (player.arenaStats?.arenaRating ?? 1200)}
                    </div>
                    
                    {/* Poke / Challenge Button */}
                    {playerData.uid && playerData.uid !== player.uid && (isSocialPokeEnabled() || isChallengeMatchEnabled()) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(player);
                        }}
                        className="ml-4 p-2 text-[#d9ad33] hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                        title="Poke or Challenge"
                      >
                        <Zap size={16} />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pinned My Rank */}
      {playerData.uid && !loading && !errorMsg && (
        <div className="h-24 bg-black/60 backdrop-blur-2xl border-t border-white/10 flex items-center px-8 z-20">
          <div className="max-w-5xl mx-auto w-full flex items-center">
            <div className="w-12 text-center text-2xl font-bold text-[#d9ad33]">
              {myRank > 0 ? `#${myRank}` : '#--'}
            </div>
            <div className="flex-1 ml-4 flex flex-col">
              <span className="font-bold text-white tracking-widest uppercase">{playerData.name || "CHAMPION"} (YOU)</span>
              <span className="text-[9px] text-[#8c7a52] font-bold tracking-[0.3em] uppercase">Current Standing</span>
            </div>
            <div className="w-32 text-center text-[10px] font-bold tracking-widest uppercase">
              {activeTab === 0 ? (
                <span style={{ color: TIER_COLORS[TIER_KEYS.indexOf(playerData.aiProgress?.tier || 'beginner')] }}>
                  {TIER_LABELS[TIER_KEYS.indexOf(playerData.aiProgress?.tier || 'beginner')]}
                </span>
              ) : (
                <span className="text-white/40">
                  {playerData.multiplayerHistory
                    ? `${playerData.multiplayerHistory.filter(h => h.result === 'win').length}W / ${playerData.multiplayerHistory.filter(h => h.result === 'loss').length}L / ${playerData.multiplayerHistory.filter(h => h.result === 'draw').length}D`
                    : '0W / 0L / 0D'}
                </span>
              )}
            </div>
            <div className="w-24 text-center text-2xl font-bold text-[#d9ad33] font-serif">
              {activeTab === 0 ? (playerData.aiProgress?.elo ?? 1200) : 1200}
            </div>
          </div>
        </div>
      )}

      {/* Status Toast Notification */}
      {actionStatus && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] bg-black/90 border border-white/10 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md text-xs font-bold uppercase tracking-widest text-[#d9ad33] text-center max-w-sm">
          {actionStatus.text}
        </div>
      )}

      {/* Poke & Challenge Confirmation Dialog */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#030204] border border-white/10 w-full max-w-sm p-6 sm:p-8 rounded-2xl shadow-2xl flex flex-col items-center"
            >
              <button 
                onClick={() => setSelectedPlayer(null)} 
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <Trophy size={40} className="text-[#d9ad33] mb-4" />
              <h2 className="text-xl font-bold text-[#f5d666] mb-1 tracking-widest uppercase font-serif text-center">
                Poke or Challenge
              </h2>
              <p className="text-white/60 text-xs mb-6 text-center">
                Choose action for <span className="text-white font-bold">{selectedPlayer.displayName}</span>
              </p>

              {/* Action Selection Tabs */}
              <div className="flex w-full gap-2 p-1 bg-black/40 rounded-xl mb-4 border border-white/5">
                <button
                  type="button"
                  onClick={() => setChallengeType('poke')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all",
                    challengeType === 'poke' ? "bg-[#d9ad33] text-black" : "text-white/40 hover:text-white/60"
                  )}
                >
                  POKE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isChallengeMatchEnabled()) {
                      setActionStatus({ type: 'error', text: getDisabledFeatureMessage('challenge') });
                      setTimeout(() => setActionStatus(null), 3000);
                      return;
                    }
                    setChallengeType('challenge');
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold tracking-widest transition-all",
                    challengeType === 'challenge' ? "bg-[#d9ad33] text-black" : "text-white/40 hover:text-white/60",
                    !isChallengeMatchEnabled() && "opacity-50"
                  )}
                >
                  CHALLENGE
                </button>
              </div>

              {/* Message Input for Challenges */}
              {challengeType === 'challenge' && (
                <div className="w-full flex flex-col items-stretch gap-2 mb-6">
                  <label className="text-[9px] text-[#8c7a52] font-bold uppercase tracking-widest">
                    Friendly duel message (optional)
                  </label>
                  <textarea
                    value={challengeMsg}
                    onChange={(e) => setChallengeMsg(e.target.value.substring(0, 120))}
                    placeholder="Enter challenge message (max 120 chars)..."
                    rows={3}
                    maxLength={120}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-[#d9ad33]/50 transition-all text-white placeholder-white/20 resize-none"
                  />
                  <div className="text-[8px] text-white/20 text-right">
                    {challengeMsg.length}/120
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSendRequest}
                  disabled={submitting}
                  className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl uppercase shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Swords size={16} />
                  {submitting ? 'SENDING...' : `SEND ${challengeType.toUpperCase()}`}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPlayer(null)}
                  className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold tracking-widest rounded-xl uppercase hover:bg-white/10 transition-all"
                >
                  CANCEL
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
