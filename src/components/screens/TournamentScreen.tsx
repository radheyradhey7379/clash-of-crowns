import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Trophy, Users, Play, ShieldAlert, Award, Loader2, CheckCircle2 } from 'lucide-react';
import { AppScreen, PlayerData } from '../../types';
import { auth } from '../../firebase';
import { playSound } from '../../lib/sounds';
import ScreenBackground from '../ui/ScreenBackground';

interface TournamentScreenProps {
  onNavigate: (screen: AppScreen, level?: any, localConfig?: any, multiplayerConfig?: any) => void;
  playerData: PlayerData;
}

export default function TournamentScreen({ onNavigate, playerData }: TournamentScreenProps) {
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const user = auth.currentUser;

  const fetchActiveTournament = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/tournaments/active');
      if (res.ok) {
        const data = await res.json();
        setTournament(data);
      } else {
        setErrorMsg("Failed to retrieve active tournament details.");
      }
    } catch (err) {
      console.error("Error fetching tournament:", err);
      setErrorMsg("Network error. Unable to connect to tournament service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTournament();
  }, []);

  const handleRegister = async () => {
    if (!user) return;
    playSound('click');
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const idToken = await user.getIdToken();
      const res = await fetch('/api/tournaments/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Successfully registered for the tournament!");
        playSound('success');
        fetchActiveTournament();
      } else {
        setErrorMsg(data.error || "Registration failed.");
      }
    } catch (err) {
      setErrorMsg("Network error during registration.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayMatch = (match: any) => {
    if (!user) return;
    playSound('click');

    const role = user.uid === match.player1.uid ? 'host' : 'guest';
    const color = user.uid === match.player1.uid ? 'w' : 'b';

    // Route to Game Screen with multiplayer config for this tournament match
    onNavigate('Game', null, null, {
      roomId: match.roomId,
      role,
      color,
      mode: 'friend', // Realtime friend match rules
      tournamentId: tournament.id,
      matchId: match.matchId
    });
  };

  const isUserRegistered = () => {
    if (!user || !tournament) return false;
    return (tournament.players || []).some((p: any) => p.uid === user.uid);
  };

  const findUserPendingMatch = () => {
    if (!user || !tournament || tournament.status !== 'active') return null;
    const currentRound = tournament.rounds?.[tournament.rounds.length - 1];
    if (!currentRound) return null;

    return (currentRound.matches || []).find(
      (m: any) => m.status === 'pending' && (m.player1?.uid === user.uid || m.player2?.uid === user.uid)
    );
  };

  const pendingMatch = findUserPendingMatch();

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#030204] text-white overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.4} />

      {/* Top Header */}
      <div className="h-20 flex items-center justify-between px-6 z-20 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <motion.button
          whileHover={{ scale: 1.05, x: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            playSound('click');
            onNavigate('Home');
          }}
          className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#d9ad33]/40 text-[#d9ad33]"
        >
          <ChevronLeft size={20} />
        </motion.button>

        <h1 className="text-lg md:text-xl font-bold tracking-[0.2em] font-serif uppercase text-center text-white">
          Tournament Arena
        </h1>

        <div className="w-10 h-10 flex items-center justify-center text-[#d9ad33]">
          <Trophy size={22} className="animate-pulse" />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 z-10 custom-scrollbar flex flex-col items-center">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 size={36} className="animate-spin text-[#d9ad33]" />
            <span className="text-xs uppercase tracking-widest text-[#8c7a52]">Retrieving Arena brackets...</span>
          </div>
        ) : errorMsg && !tournament ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md gap-4">
            <ShieldAlert size={48} className="text-red-500" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Arena Offline</h3>
            <p className="text-xs text-white/55 leading-relaxed">{errorMsg}</p>
            <button
              onClick={fetchActiveTournament}
              className="px-6 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold tracking-widest"
            >
              RETRY CONNECTION
            </button>
          </div>
        ) : !tournament ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md gap-4">
            <Trophy size={48} className="text-white/25" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">No Active Tournament</h3>
            <p className="text-xs text-white/55 leading-relaxed">
              There is currently no active championship running. Stay tuned for the next official season!
            </p>
          </div>
        ) : (
          <div className="w-full max-w-4xl space-y-6">
            {/* Status Panel */}
            <div className="p-6 rounded-3xl bg-[#09090b]/80 border border-white/5 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d9ad33]/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-2 text-center md:text-left">
                <span className="text-[10px] px-2 py-1 rounded bg-[#d9ad33]/15 text-[#d9ad33] border border-[#d9ad33]/30 font-black tracking-widest uppercase">
                  {tournament.status}
                </span>
                <h2 className="text-2xl font-bold font-serif text-white tracking-wide mt-2">{tournament.name}</h2>
                <p className="text-xs text-white/60">
                  {tournament.status === 'registration' 
                    ? "Register now to participate in this single-elimination championship." 
                    : "The bracket is live. Advance through your matches to win the Crown!"}
                </p>
              </div>

              {/* Action area based on status */}
              <div className="flex flex-col items-center md:items-end gap-3 min-w-[200px]">
                {tournament.status === 'registration' ? (
                  isUserRegistered() ? (
                    <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-3 rounded-xl text-xs font-bold tracking-widest uppercase">
                      <CheckCircle2 size={16} /> Registered
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRegister}
                      disabled={actionLoading}
                      className="w-full py-3 bg-[#d9ad33] text-black font-bold tracking-widest rounded-xl hover:brightness-110 disabled:opacity-50 text-xs uppercase"
                    >
                      {actionLoading ? "Registering..." : "REGISTER NOW"}
                    </motion.button>
                  )
                ) : tournament.status === 'active' ? (
                  pendingMatch ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePlayMatch(pendingMatch)}
                      className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold tracking-widest rounded-xl hover:brightness-110 text-xs flex items-center justify-center gap-2 uppercase"
                    >
                      <Play size={14} fill="currentColor" /> Play Your Match
                    </motion.button>
                  ) : (
                    <div className="text-center md:text-right">
                      <span className="text-xs text-white/40 uppercase tracking-widest block">Your Match Status</span>
                      <span className="text-xs font-bold text-white/70 tracking-widest uppercase block mt-1">
                        {isUserRegistered() ? "Waiting for Opponent / Next Round" : "Spectating Mode Only"}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="text-center md:text-right space-y-1">
                    <span className="text-xs text-[#d9ad33] font-bold tracking-widest uppercase flex items-center justify-center md:justify-end gap-2">
                      <Award size={16} /> Winner Crowned
                    </span>
                    <span className="text-sm font-serif text-white font-bold block">
                      {tournament.winner?.name || "No Champion"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error/Success Feedbacks */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-red-950/20 border border-red-500/40 text-red-200 text-xs rounded-2xl uppercase tracking-widest text-center"
                >
                  {errorMsg}
                </motion.div>
              )}
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-green-950/20 border border-green-500/40 text-green-200 text-xs rounded-2xl uppercase tracking-widest text-center"
                >
                  {successMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bracket Visualizer Round Nodes */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold tracking-[0.2em] uppercase text-[#8c7a52] flex items-center gap-2">
                <Users size={16} /> Tournament Brackets
              </h3>

              {tournament.rounds && tournament.rounds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tournament.rounds.map((round: any, rIdx: number) => (
                    <div key={rIdx} className="space-y-4 p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md">
                      <div className="border-b border-white/10 pb-2 flex justify-between items-center">
                        <span className="text-xs font-bold text-white tracking-widest uppercase">{round.name}</span>
                        <span className="text-[10px] text-white/40 font-mono">ROUND {rIdx + 1}</span>
                      </div>
                      <div className="space-y-3">
                        {round.matches.map((match: any, mIdx: number) => {
                          const isMyMatch = user && (match.player1.uid === user.uid || match.player2.uid === user.uid);
                          return (
                            <div
                              key={mIdx}
                              className={`p-3 rounded-xl border text-xs relative ${
                                isMyMatch
                                  ? 'bg-[#d9ad33]/10 border-[#d9ad33]/45 shadow-[0_4px_15px_rgba(217,173,51,0.1)]'
                                  : 'bg-black/30 border-white/5'
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium ${match.winnerUid === match.player1.uid ? 'text-[#d9ad33] font-bold' : 'text-white/70'}`}>
                                    {match.player1.name}
                                  </span>
                                  {match.winnerUid === match.player1.uid && <Trophy size={10} className="text-[#d9ad33]" />}
                                </div>
                                <div className="border-t border-white/5 my-1" />
                                <div className="flex justify-between items-center">
                                  <span className={`font-medium ${match.winnerUid === match.player2.uid ? 'text-[#d9ad33] font-bold' : 'text-white/70'}`}>
                                    {match.player2.name}
                                  </span>
                                  {match.winnerUid === match.player2.uid && <Trophy size={10} className="text-[#d9ad33]" />}
                                </div>
                              </div>

                              <div className="absolute top-2 right-2">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase ${
                                  match.status === 'completed'
                                    ? 'bg-white/10 text-white/50'
                                    : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                }`}>
                                  {match.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-white/40 uppercase tracking-widest">
                  No matches generated yet. Registration phase active.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
