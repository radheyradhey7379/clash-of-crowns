import React, { useState } from 'react';
import { LogIn, LogOut, Copy, Check, Shield } from 'lucide-react';
import { auth } from '../../firebase';
import { PlayerData } from '../../types';
import { playSound } from '../../lib/sounds';

interface AccountCardProps {
  playerData: PlayerData;
  onGoogleSignIn: () => void;
  onLogout: () => void;
}

export default function AccountCard({ playerData, onGoogleSignIn, onLogout }: AccountCardProps) {
  const [copied, setCopied] = useState(false);
  const user = auth.currentUser;
  const isGuest = !user || playerData.uid?.startsWith('guest_');
  const playerId = playerData.uid || 'N/A';

  const handleCopy = () => {
    playSound('click');
    navigator.clipboard.writeText(playerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-black/50 border border-white/10 rounded-2xl p-4 md:p-6 w-full shadow-2xl relative overflow-hidden">
      {/* Golden accent border */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#d9ad33] to-transparent" />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* User Info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border border-[#d9ad33]/40 bg-[#d9ad33]/10 flex items-center justify-center text-[#d9ad33] shadow-[0_0_15px_rgba(217,173,51,0.15)] overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <Shield size={24} />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-white font-serif text-lg font-bold tracking-wider">
              {isGuest ? 'Guest Player' : (user?.displayName || playerData.name)}
            </span>
            <span className="text-xs text-[#8c7a52] uppercase tracking-[0.2em] font-medium mt-0.5">
              {isGuest ? 'Sign in to save progress' : 'Progress synced'}
            </span>
            {user?.email && (
              <span className="text-[10px] text-white/40 font-mono mt-0.5">{user.email}</span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isGuest ? (
            <button
              onClick={() => { playSound('click'); onGoogleSignIn(); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#d9ad33] hover:bg-[#f5d666] text-black font-bold tracking-widest text-xs uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(217,173,51,0.2)]"
            >
              <LogIn size={14} />
              Sign In
            </button>
          ) : (
            <button
              onClick={() => { playSound('click'); onLogout(); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold tracking-widest text-xs uppercase rounded-xl transition-all"
            >
              <LogOut size={14} />
              Logout
            </button>
          )}
        </div>
      </div>

      {/* ID & Stats Footer */}
      <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[#8c7a52] font-semibold tracking-wider uppercase">Player ID:</span>
          <span className="text-white/60 font-mono select-all text-[11px] truncate max-w-[150px] sm:max-w-none">{playerId}</span>
          <button
            onClick={handleCopy}
            className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#d9ad33] transition-all flex items-center justify-center"
            title="Copy Player ID"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
          {copied && <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider animate-pulse">Copied</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#d9ad33] font-bold tracking-wider">
            ELO: <span className="font-serif text-white">{playerData.rating}</span>
          </span>
          <span className="text-[#d9ad33] font-bold tracking-wider">
            W/L: <span className="font-serif text-white">{playerData.wins}/{playerData.losses}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
