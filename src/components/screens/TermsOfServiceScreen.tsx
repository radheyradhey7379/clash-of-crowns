import React from 'react';
import { motion } from 'motion/react';
import { AppScreen, PlayerData } from '../../types';
import { ChevronLeft } from 'lucide-react';
import ScreenBackground from '../ui/ScreenBackground';
import { playSound } from '../../lib/sounds';

interface TermsOfServiceScreenProps {
  onNavigate: (screen: AppScreen) => void;
  playerData: PlayerData;
}

export default function TermsOfServiceScreen({ onNavigate, playerData }: TermsOfServiceScreenProps) {
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
        <h1 className="text-lg font-bold text-[#d9ad33] tracking-[0.15em] font-serif uppercase">Terms of Service</h1>
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
              Draft — These terms will be finalized before public release.
            </span>
          </div>

          {/* 1. Acceptance */}
          <TermsSection title="1. Acceptance of Terms">
            By downloading, installing, or using Clash of Crowns ("the App"), you acknowledge that you have
            read, understood, and agree to be bound by these Terms of Service. If you do not agree with any
            part of these terms, you must not use the App.
          </TermsSection>

          {/* 2. Fair Play */}
          <TermsSection title="2. Fair Play">
            <TermsList items={[
              'All users are expected to play fairly and honestly in every game mode.',
              'Cheating, tampering with game files, exploiting bugs or glitches, or using external tools, scripts, or engines to gain an unfair advantage is strictly prohibited.',
              'Violation of fair play standards may result in temporary account restrictions, rating adjustments, or permanent account bans at our discretion.',
            ]} />
          </TermsSection>

          {/* 3. Account & Security */}
          <TermsSection title="3. Account & Security">
            <TermsList items={[
              'You are solely responsible for maintaining the security and confidentiality of your account credentials.',
              'Session locks may be applied automatically for security purposes to protect your account from unauthorized access.',
              'Do not share your account login information with others. We are not responsible for any loss or damage arising from unauthorized use of your account.',
            ]} />
          </TermsSection>

          {/* 4. Online Services */}
          <TermsSection title="4. Online Services">
            <TermsList items={[
              'Online features including multiplayer matchmaking, real-time chat, leaderboards, and cloud synchronization are provided on an "as-is" basis.',
              'We do not guarantee uninterrupted, error-free, or continuous availability of any online service.',
              'Scheduled or emergency server maintenance may temporarily restrict access to online features. We will endeavor to provide advance notice when possible.',
            ]} />
          </TermsSection>

          {/* 5. User Conduct */}
          <TermsSection title="5. User Conduct">
            <TermsList items={[
              'Treat all other players with respect and sportsmanship in multiplayer matches and chat interactions.',
              'Harassment, bullying, hate speech, discriminatory language, threats, and any form of offensive behavior are strictly prohibited.',
              'We reserve the right to monitor, moderate, and take action against accounts that violate these conduct standards, including issuing warnings, temporary suspensions, or permanent bans.',
            ]} />
          </TermsSection>

          {/* 6. Intellectual Property */}
          <TermsSection title="6. Intellectual Property">
            All game assets, visual designs, user interface elements, audio, and source code within Clash
            of Crowns are the exclusive intellectual property of Apex Optima. Reverse engineering,
            decompiling, disassembling, or otherwise attempting to derive the source code of the App is
            strictly prohibited. Unauthorized reproduction or distribution of any part of the App is not
            permitted.
          </TermsSection>

          {/* 7. Purchases */}
          <TermsSection title="7. Purchases">
            Premium features, cosmetic items, and other in-app offerings are entirely optional and do not
            affect core gameplay. All purchases are final and non-refundable, except where required by
            applicable law or the policies of the platform through which the purchase was made. Pricing
            and availability of premium content may change without prior notice.
          </TermsSection>

          {/* 8. Limitation of Liability */}
          <TermsSection title="8. Limitation of Liability">
            The App is provided "as is" and "as available" without warranties of any kind, either express
            or implied. To the maximum extent permitted by applicable law, Apex Optima shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages, including but not
            limited to loss of data, service interruptions, or any damages arising from the use or inability
            to use the App.
          </TermsSection>

          {/* 9. Account Deletion */}
          <TermsSection title="9. Account Deletion">
            You may delete your account and all associated data at any time by navigating to Settings →
            Your Data → Delete All My Data within the App. Account deletion is permanent and cannot be
            reversed. Once deleted, all progress, statistics, match history, and account information will
            be irrecoverably erased from our systems.
          </TermsSection>

          {/* 10. Changes to Terms */}
          <TermsSection title="10. Changes to These Terms">
            We reserve the right to update, modify, or replace these Terms of Service at any time. Material
            changes will be communicated through the App or via other appropriate channels. Your continued
            use of the App following any changes constitutes your acceptance of the revised terms. We
            encourage you to review these terms periodically.
          </TermsSection>

        </div>
      </div>
    </div>
  );
}

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[#d9ad33] text-sm font-bold tracking-[0.1em] font-serif">{title}</h2>
      <div className="text-white/60 text-xs leading-relaxed">{children}</div>
    </div>
  );
}

function TermsList({ items }: { items: string[] }) {
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
