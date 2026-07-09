import React from 'react';
import { COMMUNITY_LINKS } from '../../config/communityLinks';
import { Youtube, Instagram, Globe, Disc } from 'lucide-react';
import { playSound } from '../../lib/sounds';

export default function CommunityLinks() {
  const links = [
    { key: 'discord', url: COMMUNITY_LINKS.discord, label: 'Discord', icon: <Disc size={18} /> },
    { key: 'youtube', url: COMMUNITY_LINKS.youtube, label: 'YouTube', icon: <Youtube size={18} /> },
    { key: 'instagram', url: COMMUNITY_LINKS.instagram, label: 'Instagram', icon: <Instagram size={18} /> },
    { key: 'website', url: COMMUNITY_LINKS.website, label: 'Website', icon: <Globe size={18} /> },
  ].filter(l => l.url !== null && l.url !== '');

  if (links.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <span className="text-[10px] text-[#8c7a52] uppercase tracking-[0.2em] font-bold">Join our community</span>
      <div className="flex justify-center items-center gap-3">
        {links.map((link) => (
          <button
            key={link.key}
            onClick={() => {
              playSound('click');
              window.open(link.url!, '_blank', 'noopener,noreferrer');
            }}
            className="p-3 bg-white/5 hover:bg-[#d9ad33]/10 border border-white/10 hover:border-[#d9ad33]/30 rounded-xl text-white/70 hover:text-[#d9ad33] transition-all flex items-center justify-center"
            title={link.label}
          >
            {link.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
