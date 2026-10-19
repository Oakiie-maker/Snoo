import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  addReelComment,
  deleteReel,
  fetchReelComments,
  fetchReels,
  reelShareLink,
  shareReel,
  toggleReelReaction,
} from '@/lib/api';
import { REACTIONS } from '@/lib/types';
import type { ReelWithMeta, ReactionEmoji, ReelComment } from '@/lib/types';
import Avatar from '@/components/Avatar';
import Modal from '@/components/Modal';
import { postShareLink, prettyCount, timeAgo } from '@/lib/utils';
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
} from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
  onCompose: () => void;
}

export default function ReelsScreen({ onOpenProfile, onCompose }: Props) {
  const { profile } = useAuth();
  const [reels, setReels] = useState<ReelWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReels(profile.id);
      setReels(r);
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
          {reels.map((r) => (
            <ReelItem
              key={r.id}
              reel={r}
              meId={profile?.id ?? ''}
              muted={muted}
              onOpenProfile={onOpenProfile}
              onDelete={() => onDelete(r)}
            />
          ))}
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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && entry.intersectionRatio > 0.6);
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (visible) {
      v.play().then(() => setPaused(false)).catch(() => {});
    } else {
      v.pause();
    }
  }, [visible, muted]);

  const togglePlay = () => {
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

  const isMine = meId === reel.author_id;
  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div ref={ref} className="h-screen w-full snap-start relative flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={reel.video_url}
        loop
        playsInline
        muted={muted}
        onClick={togglePlay}
        className="h-full w-full object-cover"
      />

      {paused && (
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

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1">
          {REACTIONS.slice(0, 1).map((r) => {
            const active = my.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => react(r.key)}
                className={`flex flex-col items-center gap-1 transition active:scale-90 ${active ? 'scale-110' : ''}`}
                aria-label={r.label}
              >
                <span className={`text-3xl ${active ? 'animate-pop' : 'opacity-90'}`}>{r.glyph}</span>
                <span className="text-xs text-white tabular-nums">{prettyCount(counts[r.key])}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={openComments}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Comments"
        >
          <MessageCircle className="w-7 h-7 drop-shadow" />
          <span className="text-xs tabular-nums">{prettyCount(commentCount)}</span>
        </button>

        <button
          onClick={share}
          className="flex flex-col items-center gap-1 text-white"
          aria-label="Share"
        >
          {copied ? <Check className="w-7 h-7 text-emerald-400 drop-shadow" /> : <Link2 className="w-7 h-7 drop-shadow" />}
          <span className="text-xs tabular-nums">{prettyCount(shareCount)}</span>
        </button>

        {isMine ? (
          <button
            onClick={onDelete}
            className="flex flex-col items-center gap-1 text-white"
            aria-label="Delete reel"
          >
            <Trash2 className="w-7 h-7 drop-shadow" />
          </button>
        ) : (
          <button onClick={() => onOpenProfile(reel.author.id)} className="mt-1">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur flex items-center justify-center ring-2 ring-white">
              <Music2 className="w-5 h-5 text-white" />
            </div>
          </button>
        )}
      </div>

      <div className="absolute left-4 bottom-24 right-20 z-10">
        <button
          onClick={() => onOpenProfile(reel.author.id)}
          className="inline-flex items-center gap-2.5 mb-2"
        >
          <Avatar profile={reel.author} size="sm" ring />
          <span className="font-semibold text-sm text-white drop-shadow">@{reel.author.username}</span>
        </button>
        {reel.caption && (
          <p className="text-sm text-white/95 mb-2 drop-shadow line-clamp-3 whitespace-pre-wrap">
            {reel.caption}
          </p>
        )}
        {reel.audio_label && (
          <div className="inline-flex items-center gap-1.5 text-xs text-white/70">
            <Music2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[180px]">{reel.audio_label}</span>
          </div>
        )}
        <div className="text-[11px] text-white/50 mt-1">{timeAgo(reel.created_at)} ago · {prettyCount(totalReactions)} reactions</div>
      </div>

      <Modal open={showComments} onClose={() => setShowComments(false)} title="Comments">
        <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto no-scrollbar">
          {comments.length === 0 ? (
            <div className="text-sm text-white/40 py-6 text-center flex flex-col items-center gap-2">
              <MessageCircle className="w-6 h-6 opacity-40" />
              Be the first to comment.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <button onClick={() => onOpenProfile(c.author.id)}>
                  <Avatar profile={c.author} size="sm" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                    <button
                      onClick={() => onOpenProfile(c.author.id)}
                      className="text-xs font-semibold text-white/80 hover:underline"
                    >
                      @{c.author.username}
                    </button>
                    <p className="text-sm break-words">{c.body}</p>
                  </div>
                  <span className="text-[11px] text-white/30 ml-2">{timeAgo(c.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <form onSubmit={submitComment} className="flex items-center gap-2 sticky bottom-0 bg-[#14141b] pt-2">
          <input
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
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
    </div>
  );
}
