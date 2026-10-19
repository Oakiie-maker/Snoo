import { useEffect, useState } from 'react';
import type { PostWithMeta, ReactionEmoji } from '@/lib/types';
import { REACTIONS } from '@/lib/types';
import {
  toggleReaction,
  fetchComments,
  addComment,
  deleteComment,
  sharePost,
} from '@/lib/api';
import { postShareLink, prettyCount, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import Avatar from './Avatar';
import Modal from './Modal';
import {
  MessageCircle,
  Send,
  Trash2,
  Link2,
  Check,
  Users,
  Play,
} from 'lucide-react';

interface Props {
  post: PostWithMeta;
  onOpenProfile?: (id: string) => void;
  onDelete?: (post: PostWithMeta) => void;
}

export default function PostCard({ post, onOpenProfile, onDelete }: Props) {
  const { profile } = useAuth();
  const meId = profile?.id ?? '';
  const [counts, setCounts] = useState(post.reaction_counts);
  const [my, setMy] = useState<Set<ReactionEmoji>>(new Set(post.my_reactions));
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [shareCount, setShareCount] = useState(post.share_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof fetchComments>>>([]);
  const [commentBody, setCommentBody] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCounts(post.reaction_counts);
    setMy(new Set(post.my_reactions));
    setCommentCount(post.comment_count);
    setShareCount(post.share_count);
  }, [post]);

  const react = async (emoji: ReactionEmoji) => {
    if (!meId) return;
    const has = my.has(emoji);
    const nextCounts = { ...counts };
    nextCounts[emoji] = Math.max(0, (nextCounts[emoji] ?? 0) + (has ? -1 : 1));
    setCounts(nextCounts);
    const nextMy = new Set(my);
    if (has) nextMy.delete(emoji);
    else nextMy.add(emoji);
    setMy(nextMy);
    await toggleReaction(post.id, meId, emoji, has);
  };

  const openComments = async () => {
    setShowComments(true);
    setLoadingComments(true);
    const c = await fetchComments(post.id);
    setComments(c);
    setLoadingComments(false);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || !meId) return;
    const body = commentBody.trim();
    setCommentBody('');
    setCommentCount((n) => n + 1);
    await addComment(post.id, meId, body);
    const c = await fetchComments(post.id);
    setComments(c);
  };

  const removeComment = async (id: string) => {
    setComments((cs) => cs.filter((c) => c.id !== id));
    setCommentCount((n) => Math.max(0, n - 1));
    await deleteComment(id);
  };

  const share = async () => {
    if (!meId) return;
    if (shareCount === 0 || !shared) {
      const ok = await sharePost(post.id, meId);
      if (ok) {
        setShareCount((n) => n + 1);
        setShared(true);
      }
    }
    const link = postShareLink(post.id);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  };

  const isAuthor = meId === post.author_id;
  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const topEmojis = REACTIONS.filter((r) => counts[r.key] > 0)
    .sort((a, b) => counts[b.key] - counts[a.key])
    .slice(0, 3);

  return (
    <article className="bg-[#14141b] border border-white/5 rounded-2xl overflow-hidden animate-fade-in">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => onOpenProfile?.(post.author.id)}>
          <Avatar profile={post.author} size="md" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onOpenProfile?.(post.author.id)}
              className="font-semibold text-sm hover:underline truncate"
            >
              @{post.author.username}
            </button>
            {post.collaborators.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-white/50">
                <span className="text-amber-400">🤝 with</span>
                {post.collaborators.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenProfile?.(c.id)}
                    className="text-pink-400 hover:underline"
                  >
                    @{c.username}
                  </button>
                ))}
              </span>
            )}
          </div>
          <div className="text-xs text-white/40">{timeAgo(post.created_at)}</div>
        </div>
        {isAuthor && onDelete && (
          <button
            onClick={() => onDelete(post)}
            className="p-2 rounded-full text-white/40 hover:text-rose-400 hover:bg-white/5 transition"
            aria-label="Delete post"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      {post.caption && (
        <p className="px-4 pb-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {post.caption}
        </p>
      )}

      {post.media_url && (
        <div className="relative bg-black">
          {post.media_type === 'video' ? (
            <video
              src={post.media_url}
              controls
              playsInline
              className="w-full max-h-[80vh] object-contain"
            />
          ) : (
            <img
              src={post.media_url}
              alt=""
              className="w-full max-h-[80vh] object-cover"
              loading="lazy"
            />
          )}
          {post.media_type === 'video' && (
            <div className="pointer-events-none absolute top-3 left-3 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              <Play className="w-3 h-3 fill-white" /> Video
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-1 mb-2">
          {REACTIONS.map((r) => {
            const count = counts[r.key] ?? 0;
            const active = my.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => react(r.key)}
                className={`group relative flex items-center gap-1 px-2.5 py-1.5 rounded-full transition active:scale-90 ${
                  active
                    ? 'bg-white/10 ring-1 ring-white/20'
                    : 'hover:bg-white/5'
                }`}
                aria-label={`${r.label} reaction`}
                aria-pressed={active}
              >
                <span className={`text-lg leading-none ${active ? 'animate-pop' : ''}`}>
                  {r.glyph}
                </span>
                {count > 0 && (
                  <span className="text-xs text-white/60 tabular-nums">{prettyCount(count)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm text-white/60">
          <span className="tabular-nums">{prettyCount(totalReactions)} reactions</span>
          {topEmojis.length > 0 && (
            <span className="flex items-center gap-0.5">
              {topEmojis.map((r) => (
                <span key={r.key} className="text-sm">
                  {r.glyph}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <button
            onClick={openComments}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="tabular-nums">{prettyCount(commentCount)}</span>
            <span className="hidden xs:inline">Comments</span>
          </button>

          <button
            onClick={share}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
            <span className="tabular-nums">{prettyCount(shareCount)}</span>
            <span>{copied ? 'Link copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      <Modal open={showComments} onClose={() => setShowComments(false)} title="Comments">
        <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto no-scrollbar">
          {loadingComments ? (
            <div className="text-sm text-white/40 py-4 text-center">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-white/40 py-6 text-center flex flex-col items-center gap-2">
              <MessageCircle className="w-6 h-6 opacity-40" />
              Be the first to comment.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <button onClick={() => onOpenProfile?.(c.author.id)}>
                  <Avatar profile={c.author} size="sm" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                    <button
                      onClick={() => onOpenProfile?.(c.author.id)}
                      className="text-xs font-semibold text-white/80 hover:underline"
                    >
                      @{c.author.username}
                    </button>
                    <p className="text-sm break-words">{c.body}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-2">
                    <span className="text-[11px] text-white/30">{timeAgo(c.created_at)}</span>
                    {c.user_id === meId && (
                      <button
                        onClick={() => removeComment(c.id)}
                        className="text-[11px] text-white/30 hover:text-rose-400 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={submitComment} className="flex items-center gap-2 sticky bottom-0 bg-[#14141b] pt-2">
          {profile && <Avatar profile={profile} size="sm" />}
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
            aria-label="Send comment"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Modal>

      {post.collaborators.length > 0 && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
          <Users className="w-3 h-3" />
          Co-created with {post.collaborators.map((c) => `@${c.username}`).join(', ')}
        </div>
      )}
    </article>
  );
}
