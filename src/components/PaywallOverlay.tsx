import React from 'react';
import type { Profile } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { Lock, Sparkles, Crown } from 'lucide-react';

interface PaywallOverlayProps {
  author: Profile;
  onSubscribeClick: () => void;
  requiredTier?: string;
}

export default function PaywallOverlay({
  author,
  onSubscribeClick,
  requiredTier = 'bronze',
}: PaywallOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
      <div className="max-w-sm w-full p-6 rounded-3xl bg-[#141522]/90 border border-amber-500/30 text-center shadow-2xl flex flex-col items-center">
        {/* Glow & Badge */}
        <div className="relative mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-pink-500 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#141522] rounded-[14px] flex items-center justify-center text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <span className="absolute -top-1 -right-1 text-xs">👑</span>
        </div>

        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-1.5">
          <span>Subscribers Only</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </h3>

        <p className="text-xs text-white/60 mb-4 max-w-xs leading-relaxed">
          This post is exclusive to{' '}
          <span className="text-white font-medium">
            {author.display_name || author.username}
          </span>
          's supporters. Subscribe to unlock backstage media, high-res downloads, and comments.
        </p>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSubscribeClick();
          }}
          className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-pink-500 text-black font-extrabold text-xs shadow-lg shadow-pink-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          <span>Unlock with Supporter Tier</span>
        </button>

        <p className="text-[10px] text-white/40 mt-3">
          Starting at only $4.99/mo &middot; Cancel anytime
        </p>
      </div>
    </div>
  );
}
