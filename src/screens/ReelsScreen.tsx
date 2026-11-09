import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  addReelComment,
  deleteReel,
  fetchReelComments,
  fetchReels,
  fetchActiveAds,
  reelShareLink,
  shareReel,
  toggleReelReaction,
  recordReelView,
  toggleReelSave,
  recordAdImpression,
  recordAdClick,
  checkUserSubscribed,
} from '@/lib/api';
import { REACTIONS } from '@/lib/types';
import type { ReelWithMeta, ReactionEmoji, ReelComment, Ad } from '@/lib/types';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import PaywallOverlay from '@/components/PaywallOverlay';
import SubscribeModal from '@/components/SubscribeModal';
import { usePresence, formatRelativeActiveTime } from '@/hooks/usePresence';
import { prettyCount, timeAgo } from '@/lib/utils';
import {
  MessageCircle,
  Send,
  Link2,
  Check,
  Trash2,
  Music2,
  Play,
  Loader2,
  Volume2,
  VolumeX,
  Eye,
  Bookmark,
  Sparkles,
  Tag,
  Crown,
  ExternalLink,
} from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
  onCompose: () => void;
}

export default function ReelsScreen({ onOpenProfile, onCompose }: Props) {
  const { profile } = useAuth();
  const [reels, setReels] = useState<ReelWithMeta[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([
        fetchReels(profile.id),
        fetchActiveAds().catch(() => []),
      ]);
      setReels(r);
      setAds(a);
    } catch {
      setError('Could not load reels.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (reel: ReelWithMeta) => {
    if (!confirm('Delete this reel?')) return;
    setReels((rs) => rs.filter((r) => r.id !== reel.id));
    await deleteReel(reel.id, reel.video_url);
  };

  // Build reel items mixed with sponsored cards every 5 items
  const feedItems: Array<{ type: 'reel'; data: ReelWithMeta } | { type: 'ad'; data: Ad; index: number }> = [];
  const adInterval = 5;
  let adCursor = 0;

  reels.forEach((r, idx) => {
    feedItems.push({ type: 'reel', data: r });
    if ((idx + 1) % adInterval === 0 && ads.length > 0) {
      feedItems.push({ type: 'ad', data: ads[adCursor % ads.length], index: idx });
      adCursor++;
    }
  });

  return (
    <div className="h-screen bg-black overflow-hidden">
      <header className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="font-bold text-lg text-white">Reels</h1>
          <button
            onClick={() => setMuted((m) => !m)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-full text-white/60">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-sm">Loading reels…</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full text-white/60 gap-3">
          <p>{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm transition"
          >
            Retry
          </button>
        </div>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-white/70 px-8 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Play className="w-7 h-7 fill-white" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">No reels yet</h2>
            <p className="text-sm text-white/50">Share your first short vertical video.</p>
          </div>
          <button
            onClick={onCompose}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg shadow-pink-500/20 hover:brightness-110 transition"
          >
            <Send className="w-4 h-4" />
            Create a reel
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full overflow-y-auto snap-y-mandatory no-scrollbar"
        >
          {feedItems.map((item) =>
            item.type === 'reel' ? (
              <ReelItem
                key={`reel-${item.data.id}`}
                reel={item.data}
                meId={profile?.id ?? ''}
                muted={muted}
                onOpenProfile={onOpenProfile}
                onDelete={() => onDelete(item.data)}
              />
            ) : (
              <SponsoredReelItem
                key={`sponsored-ad-${item.data.id}-${item.index}`}
                ad={item.data}
                onOpenProfile={onOpenProfile}
              />
            )
          )}
          <div className="h-24 snap-start" />
        </div>
      )}
    </div>
  );
}

function ReelItem({
  reel,
  meId,
  muted,
  onOpenProfile,
  onDelete,
}: {
  reel: ReelWithMeta;
  meId: string;
  muted: boolean;
  onOpenProfile: (id: string) => void;
  onDelete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [counts, setCounts] = useState(reel.reaction_counts);
  const [my, setMy] = useState<Set<ReactionEmoji>>(new Set(reel.my_reactions));
  const [commentCount, setCommentCount] = useState(reel.comment_count);
  const [shareCount, setShareCount] = useState(reel.share_count);
  const [viewsCount, setViewsCount] = useState(reel.views_count);
  const [saveCount, setSaveCount] = useState(reel.save_count);
  const [isSaved, setIsSaved] = useState(reel.is_saved);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);

  // Paywall & Subscriptions
  const isMine = meId === reel.author_id;
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const viewTimerRef = useRef<number | null>(null);
  const hasViewedRef = useRef(false);

  const { isUserOnline } = usePresence();
  const authorOnline = isUserOnline(reel.author.id, reel.author);

  useEffect(() => {
    if (reel.is_subscribers_only && !isMine && meId) {
      checkUserSubscribed(meId, reel.author_id).then(setIsSubscribed).catch(console.error);
    }
  }, [reel, isMine, meId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const isNowVisible = entry.isIntersecting && entry.intersectionRatio > 0.6;
        setVisible(isNowVisible);

        // Track view when in viewport > 1s
        if (isNowVisible && !hasViewedRef.current && meId) {
          if (!viewTimerRef.current) {
            viewTimerRef.current = window.setTimeout(async () => {
              hasViewedRef.current = true;
              await recordReelView(reel.id, meId, 1500);
              setViewsCount((v) => v + 1);
            }, 1000);
          }
        } else if (!isNowVisible && viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, [reel.id, meId]);

  const isPaywalled = reel.is_subscribers_only && !isMine && !isSubscribed;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (visible && !isPaywalled) {
      v.play().then(() => setPaused(false)).catch(() => {});
    } else {
      v.pause();
    }
  }, [visible, muted, isPaywalled]);

  const togglePlay = () => {
    if (isPaywalled) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const react = async (emoji: ReactionEmoji) => {
    if (!meId) return;
    const has = my.has(emoji);
    setCounts((c) => ({ ...c, [emoji]: Math.max(0, c[emoji] + (has ? -1 : 1)) }));
    setMy((s) => {
      const n = new Set(s);
      if (has) n.delete(emoji);
      else n.add(emoji);
      return n;
    });
    await toggleReelReaction(reel.id, meId, emoji, has);
  };

  const handleToggleSave = async () => {
    if (!meId) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setSaveCount((n) => Math.max(0, n + (nextSaved ? 1 : -1)));
    await toggleReelSave(reel.id, meId, isSaved);
  };

  const openComments = async () => {
    setShowComments(true);
    const c = await fetchReelComments(reel.id);
    setComments(c);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || !meId) return;
    const body = commentBody.trim();
    setCommentBody('');
    setCommentCount((n) => n + 1);
    await addReelComment(reel.id, meId, body);
    const c = await fetchReelComments(reel.id);
    setComments(c);
  };

  const share = async () => {
    if (!meId) return;
    if (shareCount === 0) {
      const ok = await shareReel(reel.id, meId);
      if (ok) setShareCount((n) => n + 1);
    }
    try {
      await navigator.clipboard.writeText(reelShareLink(reel.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const engagementRate = Number(
    (
      ((totalReactions + commentCount + shareCount + saveCount) / Math.max(viewsCount, 1)) *
      100
    ).toFixed(1),
  );

  return (
    <div ref={ref} className="h-screen w-full snap-start relative flex items-center justify-center bg-black overflow-hidden">
      <div className={`h-full w-full ${isPaywalled ? 'blur-2xl filter scale-105' : ''}`}>
        <video
          ref={videoRef}
          src={reel.video_url}
          loop
          playsInline
          muted={muted}
          onClick={togglePlay}
          className="h-full w-full object-cover"
        />
      </div>

      {isPaywalled && (
        <PaywallOverlay
          author={reel.author}
          onSubscribeClick={() => setShowSubscribeModal(true)}
        />
      )}

      {paused && !isPaywalled && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-label="Play"
        >
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-7 h-7 fill-white text-white" />
          </div>
        </button>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

      {/* Right Action Rail */}
      <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-4">
        {/* Reaction */}
        <div className="flex flex-col items-center gap-1">
          {REACTIONS.slice(0, 1).map((r) => {
            const active = my.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => react(r.key)}
                className={`flex flex-col items-center gap-0.5 transition active:scale-90 ${
                  active ? 'scale-110' : ''
                }`}
                aria-label={r.label}
              >
                <span className={`text-3xl ${active ? 'animate-pop' : 'opacity-90'}`}>
                  {r.glyph}
                </span>
                <span className="text-xs text-white tabular-nums font-semibold drop-shadow">
                  {prettyCount(counts[r.key])}
                </span>
              </button>
            );
          })}
        </div>

        {/* Comments */}
        <button
          onClick={openComments}
          className="flex flex-col items-center gap-0.5 text-white"
          aria-label="Comments"
        >
          <MessageCircle className="w-7 h-7 drop-shadow" />
          <span className="text-xs tabular-nums font-semibold drop-shadow">
            {prettyCount(commentCount)}
          </span>
        </button>

        {/* Save / Bookmark */}
        <button
          onClick={handleToggleSave}
          className="flex flex-col items-center gap-0.5 text-white"
          aria-label={isSaved ? 'Remove save' : 'Save reel'}
        >
          <Bookmark
            className={`w-7 h-7 drop-shadow transition ${
              isSaved ? 'fill-amber-400 text-amber-400' : ''
            }`}
          />
          <span className="text-xs tabular-nums font-semibold drop-shadow">
            {prettyCount(saveCount)}
          </span>
        </button>

        {/* Share */}
        <button
          onClick={share}
          className="flex flex-col items-center gap-0.5 text-white"
          aria-label="Share"
        >
          {copied ? (
            <Check className="w-7 h-7 text-emerald-400 drop-shadow" />
          ) : (
            <Link2 className="w-7 h-7 drop-shadow" />
          )}
          <span className="text-xs tabular-nums font-semibold drop-shadow">
            {prettyCount(shareCount)}
          </span>
        </button>

        {/* Delete or Audio avatar */}
        {isMine ? (
          <button
            onClick={onDelete}
            className="flex flex-col items-center gap-1 text-white/70 hover:text-rose-400"
            aria-label="Delete reel"
          >
            <Trash2 className="w-6 h-6 drop-shadow" />
          </button>
        ) : (
          <button onClick={() => onOpenProfile(reel.author.id)} className="mt-1">
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center ring-2 ring-white">
              <Music2 className="w-4 h-4 text-white" />
            </div>
          </button>
        )}
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute left-4 bottom-24 right-20 z-10">
        <button
          onClick={() => onOpenProfile(reel.author.id)}
          className="inline-flex items-center gap-2.5 mb-2"
        >
          <Avatar
            profile={reel.author}
            size="sm"
            ring
            showStatus
            isOnline={authorOnline}
          />
          <span className="font-semibold text-sm text-white drop-shadow">
            @{reel.author.username}
          </span>
          {authorOnline && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm shadow-emerald-500/50" />
          )}
        </button>

        {/* Paid Partnership Badge */}
        {reel.paid_partnership_brand && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-[11px] font-semibold text-blue-300 backdrop-blur-md">
              <Tag className="w-3 h-3 text-blue-400" />
              <span>Paid partnership with {reel.paid_partnership_brand}</span>
            </span>
          </div>
        )}

        {/* Subscribers Only Badge */}
        {reel.is_subscribers_only && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-300 backdrop-blur-md">
              <Crown className="w-3 h-3" /> Subscribers Only
            </span>
          </div>
        )}

        {reel.caption && (
          <p className="text-sm text-white/95 mb-2 drop-shadow line-clamp-3 whitespace-pre-wrap">
            {reel.caption}
          </p>
        )}

        {reel.audio_label && (
          <div className="inline-flex items-center gap-1.5 text-xs text-white/70 mb-1">
            <Music2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[180px]">{reel.audio_label}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-white/60 drop-shadow mt-1">
          <span className="flex items-center gap-1 font-medium text-white/80">
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>{prettyCount(viewsCount)}</span>
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-pink-300 font-semibold bg-black/40 px-2 py-0.5 rounded-full border border-pink-500/30">
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>{engagementRate}% ER</span>
          </span>
          <span>•</span>
          <span>{timeAgo(reel.created_at)}</span>
        </div>
      </div>

      {/* Reel Comments Modal */}
      <Modal open={showComments} onClose={() => setShowComments(false)} title="Comments">
        <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto no-scrollbar">
          {comments.length === 0 ? (
            <div className="text-sm text-white/40 py-6 text-center flex flex-col items-center gap-2">
              <MessageCircle className="w-6 h-6 opacity-40" />
              Be the first to comment on this reel.
            </div>
          ) : (
            comments.map((c) => {
              const cOnline = isUserOnline(c.author.id, c.author);
              const cStatus = formatRelativeActiveTime(
                c.author.last_seen,
                cOnline,
                c.author.show_online_status,
              );
              return (
                <div key={c.id} className="flex gap-2.5">
                  <button onClick={() => onOpenProfile(c.author.id)}>
                    <Avatar profile={c.author} size="sm" showStatus isOnline={cOnline} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenProfile(c.author.id)}
                          className="text-xs font-semibold text-white/80 hover:underline"
                        >
                          @{c.author.username}
                        </button>
                        {cOnline && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                        <span className="text-[10px] text-white/40">{cStatus.label}</span>
                      </div>
                      <p className="text-sm break-words mt-0.5 text-white/90">{c.body}</p>
                    </div>
                    <span className="text-[11px] text-white/30 ml-2">{timeAgo(c.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form onSubmit={submitComment} className="flex items-center gap-2 sticky bottom-0 bg-[#14141b] pt-2">
          <input
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-pink-500/50 transition text-white placeholder-white/30"
          />
          <button
            type="submit"
            disabled={!commentBody.trim()}
            className="p-2.5 rounded-full bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 disabled:opacity-40 transition"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Modal>

      {/* Subscription Modal for Paywalled Reel */}
      <SubscribeModal
        creator={reel.author}
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onSuccess={() => setIsSubscribed(true)}
      />
    </div>
  );
}

function SponsoredReelItem({
  ad,
  onOpenProfile,
}: {
  ad: Ad;
  onOpenProfile: (id: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const recordedImpression = useRef(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || recordedImpression.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !recordedImpression.current) {
        recordedImpression.current = true;
        recordAdImpression(ad.id).catch(console.error);
      }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad.id]);

  const handleClick = () => {
    recordAdClick(ad.id).catch(console.error);
    window.open(ad.target_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={cardRef}
      className="h-screen w-full snap-start relative flex items-center justify-center bg-zinc-950 overflow-hidden"
    >
      <img
        src={ad.media_url}
        alt={ad.title}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 pointer-events-none" />

      {/* Top Sponsored Tag */}
      <div className="absolute top-16 left-4 z-10 flex items-center gap-2">
        <span className="px-3 py-1 rounded-full bg-amber-500/90 text-black text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> Sponsored
        </span>
      </div>

      {/* Bottom Ad Card details & CTA button */}
      <div className="absolute left-4 right-4 bottom-24 z-10 bg-black/50 backdrop-blur-md p-5 rounded-3xl border border-white/10 shadow-2xl">
        <div
          onClick={() => onOpenProfile(ad.advertiser_id)}
          className="flex items-center gap-3 mb-2 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-sm">
            {ad.brand_name.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
              {ad.brand_name}
            </h3>
            <span className="text-[10px] text-white/50">Promoted Brand Partner</span>
          </div>
        </div>

        <h2 className="text-base font-bold text-white mb-1.5">{ad.title}</h2>
        <p className="text-xs text-white/80 line-clamp-2 mb-4 leading-relaxed">{ad.description}</p>

        <button
          onClick={handleClick}
          className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-extrabold text-sm shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>{ad.cta_text || 'Learn More'}</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
