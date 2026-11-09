import { useState } from 'react';
import confetti from 'canvas-confetti';
import { subscribeToCreator } from '@/lib/api';
import type { Profile, SubscriptionTier } from '@/lib/types';
import { TIER_CONFIG } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { X, Check, Crown, Award, ShieldCheck, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface SubscribeModalProps {
  creator: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tier: SubscriptionTier) => void;
}

export default function SubscribeModal({
  creator,
  isOpen,
  onClose,
  onSuccess,
}: SubscribeModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('silver');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await subscribeToCreator(creator.id, selectedTier);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#eab308', '#ec4899', '#3b82f6', '#8b5cf6'],
      });
      setCompleted(true);
      if (onSuccess) onSuccess(selectedTier);
      setTimeout(() => {
        setCompleted(false);
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to subscribe';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tiers: SubscriptionTier[] = ['bronze', 'silver', 'gold'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#12131c] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {completed ? (
          <div className="py-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/10 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              Welcome to the Inner Circle! 🎉
            </h3>
            <p className="text-sm text-white/70">
              You are now a{' '}
              <span className="font-semibold text-amber-400">
                {TIER_CONFIG[selectedTier].name}
              </span>{' '}
              supporter of {creator.display_name || creator.username}.
            </p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <Avatar user={creator} size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">
                    Subscribe to {creator.display_name || creator.username}
                  </h2>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-xs text-white/50">
                  Unlock exclusive posts, backstage reels, and custom badges.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Tiers list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {tiers.map((tierKey) => {
                const conf = TIER_CONFIG[tierKey];
                const isSelected = selectedTier === tierKey;
                return (
                  <div
                    key={tierKey}
                    onClick={() => setSelectedTier(tierKey)}
                    className={`relative p-4 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-white/10 to-white/5 border-amber-500/60 shadow-lg shadow-amber-500/10 scale-[1.02]'
                        : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                    }`}
                  >
                    {tierKey === 'gold' && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-black uppercase tracking-wider">
                        Best Value
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{conf.badge}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-white">{conf.name}</h4>
                      <p className="text-lg font-extrabold text-amber-400 mt-0.5">
                        ${conf.price}
                        <span className="text-[10px] text-white/40 font-normal">/mo</span>
                      </p>

                      <ul className="mt-3 space-y-1.5">
                        {conf.perks.map((perk, i) => (
                          <li key={i} className="text-[11px] text-white/70 flex items-start gap-1.5 leading-tight">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Summary & Action */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 mb-5 flex items-center justify-between text-xs text-white/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Cancel anytime &middot; Instant access to locked posts</span>
              </div>
              <span className="font-bold text-white">
                ${TIER_CONFIG[selectedTier].price}/month
              </span>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-black font-extrabold text-sm shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activating Subscription...</span>
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4" />
                  <span>
                    Join {TIER_CONFIG[selectedTier].name} (${TIER_CONFIG[selectedTier].price}/mo)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
