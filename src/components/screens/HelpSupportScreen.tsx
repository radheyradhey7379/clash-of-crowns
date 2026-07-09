import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft, Mail, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';
import { playSound } from '../../lib/sounds';

interface HelpSupportScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

const FAQ_ITEMS = [
  {
    question: 'How do I save my progress?',
    answer: 'Sign in with Google to sync progress to the cloud.',
  },
  {
    question: 'How does Offline Mode work?',
    answer: 'Play against AI offline using the built-in WebAssembly engine.',
  },
  {
    question: 'Why is internet needed for some features?',
    answer: 'Multiplayer, leaderboards, and cloud sync require internet.',
  },
  {
    question: 'How do I change my settings?',
    answer: 'Go to Settings from the home screen to adjust sound, graphics, language, and more.',
  },
  {
    question: 'How do I delete my data?',
    answer: 'Go to Settings → Your Data → Delete All My Data.',
  },
];

export default function HelpSupportScreen({ onNavigate, playerData }: HelpSupportScreenProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    playSound('click');
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#030204] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between z-10 w-full px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('click'); onNavigate('Settings'); }}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#d9ad33]">
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-lg font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">Help & Support</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 w-full overflow-y-auto z-10" style={{
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
      }}>
        <div className="max-w-2xl w-full mx-auto flex flex-col gap-5 pt-2 pb-8">

          {/* Contact Support */}
          <motion.a
            href="mailto:support@clashofcrowns.com?subject=Clash%20of%20Crowns%20-%20Support%20Request"
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <Mail size={20} className="text-[#d9ad33] flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold tracking-wide">Contact Support</span>
              <span className="text-[#8c7a52] text-xs mt-0.5">support@clashofcrowns.com</span>
            </div>
          </motion.a>

          {/* Report a Bug */}
          <motion.a
            href="mailto:support@clashofcrowns.com?subject=Clash%20of%20Crowns%20-%20Bug%20Report"
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 w-full py-4 px-5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <AlertCircle size={20} className="text-[#d9ad33] flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-white text-sm font-semibold tracking-wide">Report a Bug</span>
              <span className="text-[#8c7a52] text-xs mt-0.5">Send us a detailed bug report</span>
            </div>
          </motion.a>

          {/* Testing Note */}
          <div className="flex items-start gap-3 py-3 px-4 bg-[#d9ad33]/5 border border-[#d9ad33]/15 rounded-xl">
            <AlertCircle size={16} className="text-[#d9ad33] mt-0.5 flex-shrink-0" />
            <p className="text-[#8c7a52] text-xs leading-relaxed">
              For internal testing feedback, contact the team directly.
            </p>
          </div>

          {/* FAQ Section */}
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={18} className="text-[#d9ad33]" />
              <h2 className="text-xs text-[#8c7a52] uppercase font-bold tracking-[0.25em]">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="flex flex-col gap-2">
              {FAQ_ITEMS.map((item, index) => (
                <div key={index} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between py-3.5 px-4 text-left"
                  >
                    <span className="text-white text-sm font-medium tracking-wide pr-3">{item.question}</span>
                    {openFaq === index
                      ? <ChevronUp size={18} className="text-[#d9ad33] flex-shrink-0" />
                      : <ChevronDown size={18} className="text-[#8c7a52] flex-shrink-0" />
                    }
                  </button>
                  {openFaq === index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="px-4 pb-4"
                    >
                      <p className="text-[#8c7a52] text-xs leading-relaxed border-t border-white/5 pt-3">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
