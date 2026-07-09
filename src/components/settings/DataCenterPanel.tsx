import React, { useState } from 'react';
import { Shield, Download, Trash2, Check, AlertTriangle, Eye } from 'lucide-react';
import { PlayerData } from '../../types';
import { playSound } from '../../lib/sounds';
import { deleteAccountData } from '../../services/account/deleteAccountService';

interface DataCenterPanelProps {
  playerData: PlayerData;
  onDataDeleted: () => void;
}

export default function DataCenterPanel({ playerData, onDataDeleted }: DataCenterPanelProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [showInfoDump, setShowInfoDump] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showLegal, setShowLegal] = useState<'privacy' | 'terms' | null>(null);

  const handleExportData = () => {
    playSound('click');
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playerData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `clash_of_crowns_user_data_${playerData.uid || 'guest'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDeleteData = async () => {
    if (deleteInput !== 'DELETE') {
      playSound('click');
      alert("Please type 'DELETE' to confirm.");
      return;
    }
    playSound('click');
    setIsDeleting(true);
    try {
      await deleteAccountData(playerData.uid);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onDataDeleted();
    } catch (err) {
      console.error("Deletion failed:", err);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white">
      {/* Privacy Policy & Terms swatches */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { playSound('click'); setShowLegal(showLegal === 'privacy' ? null : 'privacy'); }}
          className={`px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-xl transition-all border ${
            showLegal === 'privacy' ? 'bg-[#d9ad33] text-black border-[#d9ad33]' : 'bg-white/5 text-white border-white/10'
          }`}
        >
          Privacy Policy
        </button>
        <button
          onClick={() => { playSound('click'); setShowLegal(showLegal === 'terms' ? null : 'terms'); }}
          className={`px-4 py-3 text-xs font-bold tracking-widest uppercase rounded-xl transition-all border ${
            showLegal === 'terms' ? 'bg-[#d9ad33] text-black border-[#d9ad33]' : 'bg-white/5 text-white border-white/10'
          }`}
        >
          Terms of Service
        </button>
      </div>

      {/* Inline Legal Viewer */}
      {showLegal && (
        <div className="p-4 bg-black/40 border border-white/10 rounded-xl text-xs text-white/70 max-h-[150px] overflow-y-auto leading-relaxed">
          {showLegal === 'privacy' ? (
            <div>
              <h4 className="font-bold text-white mb-2 text-sm">PRIVACY POLICY</h4>
              <p className="mb-2">We collect and process your user name, email, ELO ratings, campaign levels, customisation choices, and active sessions solely to provide cloud storage, security audits, and live multiplayer features.</p>
              <p>For security, fraud prevention, and session auditing requirements, some server logging references are preserved securely in an anonymised manner. You can request deletion of all personal references at any time.</p>
            </div>
          ) : (
            <div>
              <h4 className="font-bold text-white mb-2 text-sm">TERMS OF SERVICE</h4>
              <p className="mb-2">Clash of Crowns is provided 'as is' for game testing purposes. Any unauthorized modification of the local Rust WebAssembly engine client memory or manipulation of online game packets is strictly prohibited and subject to account security locks.</p>
              <p>By using the online matchmaking and chat rooms, you agree to treat other players with respect and adhere to fair play guidelines.</p>
            </div>
          )}
        </div>
      )}

      {/* Your Data Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => { playSound('click'); setShowInfoDump(!showInfoDump); }}
          className="flex items-center justify-between p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all"
        >
          <div className="flex items-center gap-3">
            <Eye className="text-[#d9ad33]" size={18} />
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm tracking-wide text-left">View Account Info</span>
              <span className="text-[10px] text-[#8c7a52] uppercase tracking-wider">Inspect progress payload summary</span>
            </div>
          </div>
          <span className="text-xs text-white/40">{showInfoDump ? 'Hide' : 'Show'}</span>
        </button>

        {showInfoDump && (
          <pre className="p-4 bg-black/80 border border-white/10 rounded-xl text-[10px] font-mono text-green-400 overflow-x-auto max-h-[180px]">
            {JSON.stringify({
              userId: playerData.uid,
              name: playerData.name,
              rating: playerData.rating,
              wins: playerData.wins,
              losses: playerData.losses,
              campaignLevel: playerData.aiProgress?.level || 1,
              homeAnimation: playerData.homeAnimation,
              boardTheme: playerData.boardTheme,
              selectedPieceSet: playerData.selectedPieceSet,
              musicOn: playerData.musicOn,
              sfxOn: playerData.sfxOn
            }, null, 2)}
          </pre>
        )}

        <button
          onClick={handleExportData}
          className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all"
        >
          <Download className="text-[#d9ad33]" size={18} />
          <div className="flex flex-col items-start">
            <span className="font-bold text-sm tracking-wide">Export My Data</span>
            <span className="text-[10px] text-[#8c7a52] uppercase tracking-wider">Download player progress file (JSON)</span>
          </div>
        </button>

        <button
          onClick={() => { playSound('click'); setShowDeleteConfirm(true); }}
          className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 rounded-2xl transition-all"
        >
          <Trash2 className="text-red-500" size={18} />
          <div className="flex flex-col items-start">
            <span className="font-bold text-sm tracking-wide text-red-400">Delete All My Data</span>
            <span className="text-[10px] text-red-500 uppercase tracking-wider">Permanently wipe cloud and local saves</span>
          </div>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-[#0b0a0d] border border-red-900/40 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col gap-6 relative">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle size={24} />
              <h3 className="font-serif font-bold text-lg uppercase tracking-wide">Confirm Data Deletion</h3>
            </div>

            <p className="text-xs text-white/70 leading-relaxed font-sans">
              This will permanently delete your account, progress, stats, cloud saves, session locks, and profile from our servers. 
              <strong> This action is immediate and cannot be undone.</strong>
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-[#8c7a52] uppercase tracking-wider font-bold">
                Type <span className="text-red-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white font-mono text-center tracking-widest text-sm focus:border-red-500/50 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { playSound('click'); setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold tracking-widest text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteData}
                disabled={deleteInput !== 'DELETE' || isDeleting}
                className={`flex-1 py-3 rounded-xl font-bold tracking-widest text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                  deleteInput === 'DELETE' && !isDeleting
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                <Trash2 size={12} />
                {isDeleting ? 'Deleting...' : 'Delete Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
