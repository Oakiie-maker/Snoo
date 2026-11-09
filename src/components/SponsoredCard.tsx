import React, { useEffect, useRef } from 'react';
import type { Ad } from '@/lib/types';
import { recordAdClick, recordAdImpression } from '@/lib/api';
import Avatar from '@/components/Avatar';
import { ExternalLink, Sparkles } from 'lucide-react';

interface SponsoredCardProps {
  ad: Ad;
  onOpenProfile?: (id: string) => void;
}

export default function SponsoredCard({ ad, onOpenProfile }: SponsoredCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const recordedImpression = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || recordedImpression.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !recordedImpression.current) {
            recordedImpression.current = true;
            recordAdImpression(ad.id).catch(console.error);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordAdClick(ad.id).catch(console.error);
    window.open(ad.target_url, '_blank', 'noopener,noreferrer');
  };

  const advertiserProfile = ad.advertiser_profile || {
    id: ad.advertiser_id,
    username: ad.brand_name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    display_name: ad.brand_name,
    avatar_url: ad.brand_logo_url,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <article
      ref={cardRef}
      className="bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-amber-500/20 rounded-2xl overflow-hidden shadow-xl hover:border-amber-500/40 transition-all duration-300"
    >
      {/* Sponsored Header */}
      <div className="p-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onOpenProfile && onOpenProfile(ad.advertiser_id)}
        >
          <div className="relative">
            <Avatar user={advertiserProfile} size="md" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500/90 text-[10px] text-black font-bold flex items-center justify-center">
              AD
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                {ad.brand_name}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Sparkles className="w-2.5 h-2.5" /> Sponsored
              </span>
            </div>
            <p className="text-xs text-white/50">{advertiserProfile.username ? `@${advertiserProfile.username}` : 'Promoted Brand'}</p>
          </div>
        </div>

        <button
          onClick={handleClick}
          className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors"
          title="Visit brand site"
        >
          <span>Visit</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ad Headline & Copy */}
      <div className="px-4 pb-3">
        <h4 className="text-sm font-semibold text-white mb-1">{ad.title}</h4>
        <p className="text-xs text-white/80 leading-relaxed">{ad.description}</p>
      </div>

      {/* Ad Media */}
      {ad.media_url && (
        <div className="relative aspect-video w-full overflow-hidden bg-black/60 group cursor-pointer" onClick={handleClick}>
          <img
            src={ad.media_url}
            alt={ad.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Quick interactive floating CTA */}
          <div className="absolute bottom-3 right-3">
            <button
              onClick={handleClick}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>{ad.cta_text || 'Learn More'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="px-4 py-3 bg-black/30 border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-white/40">
          Targeted to your interests &middot; Snoo Ad Network
        </span>
        <button
          onClick={handleClick}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          {ad.cta_text || 'Shop Now'} &rarr;
        </button>
      </div>
    </article>
  );
}
