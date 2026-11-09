import { useState, useEffect, useRef } from 'react';
import type { LiveStream, LiveMessage, Profile } from '@/lib/types';
import { fetchLiveMessages, sendLiveMessage, moderateContentSafety } from '@/lib/api';
import Avatar from '@/components/Avatar';
import TipModal from '@/components/TipModal';
import {
  X,
  Send,
  Heart,
  Flame,
  Sparkles,
  Pin,
  Users,
  Volume2,
  VolumeX,
  DollarSign,
  AlertCircle,
  Radio,
} from 'lucide-react';

interface LiveStreamModalProps {
  stream: LiveStream;
  currentUser: Profile;
  isOpen: boolean;
  onClose: () => void;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number; // percentage 10-90%
}

export default function LiveStreamModal({
  stream,
  currentUser,
  isOpen,
  onClose,
}: LiveStreamModalProps) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showTipModal, setShowTipModal] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const reactionIdRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadMessages = async () => {
      try {
        const msgs = await fetchLiveMessages(stream.id);
        if (isMounted) setMessages(msgs);
      } catch (err) {
        console.error('Failed to load live messages:', err);
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, stream.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const triggerReaction = (emoji: string) => {
    const id = ++reactionIdRef.current;
    const left = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setReactions((prev) => [...prev, { id, emoji, left }]);

    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setSafetyWarning(null);
    setIsSending(true);

    try {
      // Screen with AI Content Safety
      const safety = await moderateContentSafety(inputText);
      if (!safety.isSafe) {
        setSafetyWarning(safety.reason || 'Message violates community safety guidelines.');
        setIsSending(false);
        return;
      }

      const newMsg = await sendLiveMessage(stream.id, inputText.trim());
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
    } catch (err) {
      console.error('Failed to send live message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full h-full max-w-5xl md:h-[90vh] bg-[#0c0d14] md:border md:border-white/10 md:rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-all backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Stage (Left / Main) */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {/* Mock Video / Stream Visual */}
          <div className="relative w-full h-full">
            <img
              src={stream.thumbnail_url || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80'}
              alt={stream.title}
              className="w-full h-full object-cover brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

            {/* Simulated Live Ambient Scanlines / Glow */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/60 pointer-events-none" />
          </div>

          {/* Floating Reaction Bursts */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {reactions.map((r) => (
              <span
                key={r.id}
                style={{ left: `${r.left}%` }}
                className="absolute bottom-16 text-3xl animate-float-reaction select-none filter drop-shadow-lg"
              >
                {r.emoji}
              </span>
            ))}
          </div>

          {/* Top Overlay Bar */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-black tracking-wider uppercase shadow-lg shadow-red-600/40 animate-pulse">
              <Radio className="w-3.5 h-3.5" /> Live
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/90 text-xs font-semibold border border-white/10">
              <Users className="w-3.5 h-3.5 text-red-400" />
              <span>{stream.viewer_count.toLocaleString()} watching</span>
            </div>
          </div>

          {/* Audio toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-4 left-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/10"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Host Info & Title (Bottom of video on mobile) */}
          <div className="absolute bottom-4 left-16 right-4 z-20 md:hidden flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              {stream.host_profile && <Avatar user={stream.host_profile} size="sm" />}
              <span className="font-semibold text-xs text-white drop-shadow">
                {stream.host_profile?.display_name || 'Creator'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Chat & Interaction Sidebar (Right) */}
        <div className="w-full md:w-80 lg:w-96 bg-[#10111a] border-t md:border-t-0 md:border-l border-white/10 flex flex-col h-[50vh] md:h-full">
          {/* Header */}
          <div className="p-4 border-b border-white/5 bg-[#121320] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {stream.host_profile && <Avatar user={stream.host_profile} size="md" />}
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white truncate">{stream.title}</h3>
                <p className="text-xs text-white/50 truncate">
                  {stream.host_profile?.display_name || stream.host_profile?.username || 'Host'}
                </p>
              </div>
            </div>

            {/* Quick Tip button */}
            {stream.host_profile && stream.host_id !== currentUser.id && (
              <button
                onClick={() => setShowTipModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 text-black font-extrabold text-xs shadow-md hover:brightness-110 active:scale-95 flex items-center gap-1 shrink-0"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Tip</span>
              </button>
            )}
          </div>

          {/* Pinned Message Banner */}
          {stream.pinned_message && (
            <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-xs">
              <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-bold text-amber-400 block text-[10px] uppercase tracking-wider">
                  Pinned by Host
                </span>
                <p className="text-white/80 line-clamp-2">{stream.pinned_message}</p>
              </div>
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/40">
                <Sparkles className="w-6 h-6 mb-2 text-amber-400/50" />
                <p>Welcome to the live chat!</p>
                <p className="text-[11px] text-white/30">Say hello and send reactions.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isHost = m.user_id === stream.host_id;
                return (
                  <div key={m.id} className="flex items-start gap-2.5 animate-fade-in">
                    {m.user_profile && <Avatar user={m.user_profile} size="xs" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-white/90 truncate">
                          {m.user_profile?.display_name || m.user_profile?.username || 'Viewer'}
                        </span>
                        {isHost && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold uppercase">
                            Host
                          </span>
                        )}
                        <span className="text-[10px] text-white/30">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-white/80 break-words leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Reaction Tray */}
          <div className="px-4 py-2 bg-[#0e0f18] border-t border-white/5 flex items-center justify-around">
            {[
              { emoji: '❤️', icon: Heart, label: 'Love' },
              { emoji: '🔥', icon: Flame, label: 'Fire' },
              { emoji: '👏', label: 'Clap' },
              { emoji: '🎉', label: 'Celebrate' },
              { emoji: '👑', label: 'Crown' },
            ].map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => triggerReaction(item.emoji)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 active:scale-125 transition-all text-base"
                title={item.label}
              >
                {item.emoji}
              </button>
            ))}
          </div>

          {/* AI Content Safety Warning */}
          {safetyWarning && (
            <div className="px-4 py-1.5 bg-red-500/10 border-t border-red-500/20 flex items-center gap-1.5 text-red-400 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{safetyWarning}</span>
            </div>
          )}

          {/* Live Message Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-[#121320] border-t border-white/10 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Send a live message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Tip Creator Modal */}
      {stream.host_profile && (
        <TipModal
          creator={stream.host_profile}
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
}
