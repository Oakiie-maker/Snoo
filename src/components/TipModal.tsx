import { useState } from 'react';
import confetti from 'canvas-confetti';
import { sendTip } from '@/lib/api';
import type { Profile } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { X, Heart, Sparkles, DollarSign, CheckCircle2, Loader2 } from 'lucide-react';

interface TipModalProps {
  creator: Profile;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export default function TipModal({ creator, isOpen, onClose, onSuccess }: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [message, setMessage] = useState<string>('Love your content! Keep creating! 🔥');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmount <= 0) {
      setError('Please enter a valid tip amount.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendTip(creator.id, currentAmount, message);
      
      // Trigger festive celebration confetti
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981'],
      });

      setCompleted(true);
      if (onSuccess) onSuccess(currentAmount);
      setTimeout(() => {
        setCompleted(false);
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send tip';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#12131c] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Subtle glow backdrop */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {completed ? (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 ring-8 ring-emerald-500/10 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">Tip Sent Successfully!</h3>
            <p className="text-sm text-white/70">
              You sent <span className="font-semibold text-emerald-400">${currentAmount.toFixed(2)}</span> to {creator.display_name || creator.username}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendTip}>
            {/* Header / Recipient Info */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-3">
                <Avatar user={creator} size="lg" />
                <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow-md">
                  <Heart className="w-3.5 h-3.5 fill-white" />
                </span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
                Tip {creator.display_name || creator.username}
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-white/50 max-w-xs mt-0.5">
                Support your favorite creators directly with fan micro-donations.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Amount Presets */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-white/70 mb-2">Select Tip Amount</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = selectedAmount === amt && !customAmount;
                  return (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        setSelectedAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-0.5 ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500 to-pink-500 text-white shadow-lg shadow-pink-500/20 scale-[1.02]'
                          : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/5'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="Or enter custom amount..."
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
                />
              </div>
            </div>

            {/* Custom Cheer Message */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-white/70 mb-1.5">
                Cheer Message (optional)
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a message to the creator..."
                maxLength={200}
                className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || currentAmount <= 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white font-bold text-sm shadow-xl shadow-pink-500/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Tip...</span>
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Send ${currentAmount.toFixed(2)} Tip</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
