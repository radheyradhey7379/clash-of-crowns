import React from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';
import { playSound } from '../../lib/sounds';

interface PrivacyPolicyScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

export default function PrivacyPolicyScreen({ onNavigate, playerData }: PrivacyPolicyScreenProps) {
  return (
    <div className="screen-root w-full h-full relative flex flex-col bg-[#030204] overflow-hidden">
      <ScreenBackground playerData={playerData} opacity={0.3} />

      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between z-10 w-full px-4 flex-shrink-0"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => { playSound('click'); onNavigate('YourData'); }}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#d9ad33]">
          <ChevronLeft size={20} />
        </motion.button>
        <h1 className="text-lg font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">Privacy Policy</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 w-full overflow-y-auto z-10" style={{
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'
      }}>
        <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 pt-2 pb-8">

          {/* Draft Banner */}
          <div className="py-2 px-4 bg-[#d9ad33]/10 border border-[#d9ad33]/20 rounded-xl text-center">
            <span className="text-[#d9ad33] text-[11px] font-bold tracking-[0.2em] uppercase">
              Draft — This policy will be finalized before public release.
            </span>
          </div>

          {/* 1. Introduction */}
          <PolicySection title="1. Introduction">
            Clash of Crowns ("the App") is developed by Apex Optima. This policy explains how we handle your
            information when you use our application. We are committed to protecting your privacy and being
            transparent about the data we collect and how it is used.
          </PolicySection>

          {/* 2. Information We Collect */}
          <PolicySection title="2. Information We Collect">
            <PolicyList items={[
              'Account information provided through Google sign-in, including your display name, email address, and profile photo.',
              'Guest player identifier — an anonymous device-generated ID used when you play without signing in.',
              'Gameplay data such as campaign progress, match statistics, ELO rating, and match history.',
              'Settings and preferences including your chosen language, theme, and sound configuration.',
              'Device and session identifiers used for security verification and anti-cheat measures.',
              'Crash reports and diagnostic logs collected to identify and resolve technical issues.',
            ]} />
          </PolicySection>

          {/* 3. How We Use Your Information */}
          <PolicySection title="3. How We Use Your Information">
            <PolicyList items={[
              'Save and synchronize your game progress across multiple devices.',
              'Authenticate your account and prevent unauthorized access.',
              'Maintain fair play and detect cheating or exploitation.',
              'Improve app performance, stability, and fix bugs.',
              'Provide customer support when you reach out to us.',
            ]} />
          </PolicySection>

          {/* 4. Offline Mode */}
          <PolicySection title="4. Offline Mode">
            When you play Clash of Crowns in offline mode, all gameplay data is stored locally on your device
            only. No information is transmitted to external servers during offline play. Your progress is
            saved to device storage and remains entirely under your control.
          </PolicySection>

          {/* 5. Online Mode & Cloud Services */}
          <PolicySection title="5. Online Mode & Cloud Services">
            We use Firebase, a service provided by Google Cloud, for authentication, real-time database
            operations, and hosting. When you use online features — including multiplayer matches,
            leaderboards, and cloud save synchronization — your gameplay data is transmitted to and stored
            on Firebase servers. These services are governed by Google Cloud's infrastructure security
            standards.
          </PolicySection>

          {/* 6. Data Sharing */}
          <PolicySection title="6. Data Sharing">
            <PolicyList items={[
              'We do not sell your personal data to third parties under any circumstances.',
              'We do not share your personal information for advertising or marketing purposes.',
              'Your data may be processed by Firebase (Google Cloud) as our infrastructure provider, solely for the purpose of operating the App\'s online services.',
            ]} />
          </PolicySection>

          {/* 7. Your Rights */}
          <PolicySection title="7. Your Rights">
            You have the right to delete all of your data at any time. This can be done from within the App
            by navigating to Settings → Your Data → Delete All My Data. Please note that data deletion is
            permanent and irreversible — once deleted, your account, progress, and statistics cannot be
            recovered.
          </PolicySection>

          {/* 8. Children's Safety */}
          <PolicySection title="8. Children's Safety">
            Clash of Crowns is a chess game suitable for players of all ages. We do not knowingly collect
            personal data from children under the age of 13 without verified parental consent. If you
            believe that a child under 13 has provided us with personal information, please contact us
            so we can take appropriate action.
          </PolicySection>

          {/* 9. Contact */}
          <PolicySection title="9. Contact">
            If you have any questions, concerns, or requests regarding this privacy policy or your personal
            data, please contact us at:{' '}
            <a href="mailto:support@clashofcrowns.com" className="text-[#d9ad33] underline">
              support@clashofcrowns.com
            </a>
          </PolicySection>

        </div>
      </div>
    </div>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[#d9ad33] text-sm font-bold tracking-[0.1em] font-serif">{title}</h2>
      <div className="text-white/60 text-xs leading-relaxed">{children}</div>
    </div>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[#d9ad33] text-xs mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
