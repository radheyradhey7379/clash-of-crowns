import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, AlertCircle, HelpCircle } from 'lucide-react';
import { playSound } from '../../lib/sounds';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "Where can I find my Player ID?",
    answer: "Your Player ID is listed under the Account card in the Settings screen. Click the copy button next to the ID to copy it to your clipboard."
  },
  {
    question: "How do I save my progress?",
    answer: "You can save your progress by signing in with your Google account. Once signed in, all your campaign levels, ELO, stats, and customisations will be synced to the cloud automatically."
  },
  {
    question: "Why do I need an internet connection for online features?",
    answer: "Live multiplayer matches, community chat, global leaderboards, and Stockfish analysis engines run on secure servers. A stable internet connection is required to communicate with these services."
  },
  {
    question: "How does Offline Mode work?",
    answer: "Clash of Crowns is fully playable offline! You can play against our custom Rust-compiled WebAssembly AI engine (NegaMax/NNUE), customise your board, and browse your previously loaded match analysis without internet."
  },
  {
    question: "Online campaign modes and multiplayer?",
    answer: "Our real-time matchmaking, competitive arena leagues, and tournaments are rolling out in public updates soon. Keep your app updated to join these tournaments as soon as they go live!"
  }
];

export default function HelpSupportPanel() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    playSound('click');
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleEmailSupport = (type: 'support' | 'bug') => {
    playSound('click');
    const subject = type === 'bug' ? 'Clash of Crowns - Bug Report' : 'Clash of Crowns - Support Request';
    const body = `Hi Support Team,\n\n[Please describe your request/bug here]\n\nPlayer ID: [Optional ID]\nDevice Details: [Optional Device Name]`;
    window.location.href = `mailto:support@clashofcrowns.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full text-white">
      {/* Support Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => handleEmailSupport('support')}
          className="flex items-center justify-center gap-3 p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all group"
        >
          <Mail className="text-[#d9ad33] group-hover:scale-110 transition-transform" size={20} />
          <div className="flex flex-col items-start">
            <span className="font-serif font-bold text-sm tracking-wide">Contact Support</span>
            <span className="text-[10px] text-[#8c7a52] uppercase tracking-wider">Email support team</span>
          </div>
        </button>

        <button
          onClick={() => handleEmailSupport('bug')}
          className="flex items-center justify-center gap-3 p-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl transition-all group"
        >
          <AlertCircle className="text-[#d9ad33] group-hover:scale-110 transition-transform" size={20} />
          <div className="flex flex-col items-start">
            <span className="font-serif font-bold text-sm tracking-wide">Report a Bug</span>
            <span className="text-[10px] text-[#8c7a52] uppercase tracking-wider">Submit gameplay feedback</span>
          </div>
        </button>
      </div>

      {/* FAQ Header */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-2">
        <HelpCircle className="text-[#d9ad33]" size={18} />
        <h3 className="font-serif font-bold text-base tracking-wider uppercase text-[#d9ad33]">Frequently Asked Questions</h3>
      </div>

      {/* FAQ list */}
      <div className="flex flex-col gap-2">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className="bg-black/30 border border-white/5 rounded-xl overflow-hidden transition-all">
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-all gap-4"
              >
                <span className="font-bold text-sm tracking-wide text-white/90">{faq.question}</span>
                {isOpen ? <ChevronUp size={16} className="text-[#d9ad33]" /> : <ChevronDown size={16} className="text-[#d9ad33]" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-white/60 leading-relaxed font-sans border-t border-white/5 bg-black/10">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
