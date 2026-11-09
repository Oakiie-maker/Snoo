import { useEffect, useState } from 'react';
import type { PostWithMeta, ReactionEmoji, SubscriptionTier } from '@/lib/types';
import { REACTIONS, TIER_CONFIG } from '@/lib/types';
import {
  toggleReaction,
  fetchComments,
  addComment,
  deleteComment,
  sharePost,
  translateText,
  moderateContentSafety,
  checkUserSubscribed,
} from '@/lib/api';
import { postShareLink, prettyCount, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { usePresence, formatRelativeActiveTime } from '@/hooks/usePresence';
import { usePostEngagement } from '@/hooks/useEngagement';
import Avatar from './Avatar';
import Modal from './Modal';
import ReactionsModal from './ReactionsModal';
import PostInsightsModal from './PostInsightsModal';
import PaywallOverlay from './PaywallOverlay';
import SubscribeModal from './SubscribeModal';
import {
  MessageCircle,
  Send,
  Trash2,
  Link2,
  Check,
  Users,
  Play,
  Eye,
  Bookmark,
  BarChart2,
  Sparkles,
  Tag,
  Languages,
  Crown,
  AlertCircle,
} from 'lucide-react';

interface Props {
  post: PostWithMeta;
  onOpenProfile?: (id: string) => void;
  onDelete?: (post: PostWithMeta) => void;
}

export default function PostCard({ post, onOpenProfile, onDelete }: Props) {
  const { profile } = useAuth();
  const meId = profile?.id ?? '';
  const { isUserOnline } = usePresence();

  const [counts, setCounts] = useState(post.reaction_counts);
  const [my, setMy] = useState<Set<ReactionEmoji>>(new Set(post.my_reactions));
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [shareCount, setShareCount] = useState(post.share_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Awaited<ReturnType<typeof fetchComments>>>([]);
  const [commentBody, setCommentBody] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  // Translation states
  const [translatedCaption, setTranslatedCaption] = useState<string | null>(null);
  const [isTranslatingCaption, setIsTranslatingCaption] = useState(false);
  const [showOriginalCaption, setShowOriginalCaption] = useState(true);
  const [translatedComments, setTranslatedComments] = useState<Record<string, string>>({});

  // Paywall & Subscription states
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const isAuthor = meId === post.author_id;

  const engagement = usePostEngagement({
    post,
    userId: meId,
  });

  useEffect(() => {
    setCounts(post.reaction_counts);
    setMy(new Set(post.my_reactions));
    setCommentCount(post.comment_count);
    setShareCount(post.share_count);

    if (post.is_subscribers_only && !isAuthor && meId) {
      checkUserSubscribed(meId, post.author_id).then(setIsSubscribed).catch(console.error);
    }
  }, [post, isAuthor, meId]);

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
    setCommentError(null);

    // AI Content Safety Screening
    const safety = await moderateContentSafety(commentBody.trim());
    if (!safety.isSafe) {
      setCommentError(safety.reason || 'Comment violates community safety rules.');
      return;
    }

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

  const handleTranslateCaption = async () => {
    if (translatedCaption) {
      setShowOriginalCaption(!showOriginalCaption);
      return;
    }
    if (!post.caption || isTranslatingCaption) return;

    setIsTranslatingCaption(true);
    try {
      const res = await translateText(post.caption, 'English');
      setTranslatedCaption(res.translatedText);
      setShowOriginalCaption(false);
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslatingCaption(false);
    }
  };

  const handleTranslateComment = async (commentId: string, text: string) => {
    if (translatedComments[commentId]) {
      const next = { ...translatedComments };
      delete next[commentId];
      setTranslatedComments(next);
      return;
    }
    try {
      const res = await translateText(text, 'English');
      setTranslatedComments((prev) => ({ ...prev, [commentId]: res.translatedText }));
    } catch (err) {
      console.error('Comment translation failed:', err);
    }
  };

  const isAuthorOnline = isUserOnline(post.author.id, post.author);
  const authorStatus = formatRelativeActiveTime(
    post.author.last_seen,
    isAuthorOnline,
    post.author.show_online_status,
  );

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const topEmojis = REACTIONS.filter((r) => counts[r.key] > 0)
    .sort((a, b) => counts[b.key] - counts[a.key])
    .slice(0, 3);

  const isPaywalled = post.is_subscribers_only && !isAuthor && !isSubscribed;

  return (
    <article
      ref={engagement.containerRef as any}
      className="bg-[#14141b] border border-white/5 rounded-2xl overflow-hidden animate-fade-in shadow-xl shadow-black/20"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => onOpenProfile?.(post.author.id)} className="relative">
          <Avatar
            profile={post.author}
            size="md"
            showStatus
            isOnline={isAuthorOnline}
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => onOpenProfile?.(post.author.id)}
              className="font-semibold text-sm hover:underline truncate text-white"
            >
              @{post.author.username}
            </button>
            {isAuthorOnline && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                Online
              </span>
            )}
            {post.is_subscribers_only && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Crown className="w-2.5 h-2.5" /> Subscribers Only
              </span>
            )}
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
          <div className="text-xs text-white/40 flex items-center gap-1.5">
            <span>{timeAgo(post.created_at)}</span>
            {!isAuthorOnline && authorStatus.label && (
              <>
                <span>•</span>
                <span>{authorStatus.label}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* View Insights Button (Creator's own posts) */}
          {isAuthor && (
            <button
              onClick={engagement.openInsightsModal}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 border border-pink-500/20 transition"
              title="View Post Insights"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Insights</span>
            </button>
          )}

          {isAuthor && onDelete && (
            <button
              onClick={() => onDelete(post)}
              className="p-2 rounded-full text-white/40 hover:text-rose-400 hover:bg-white/5 transition"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Paid Partnership Disclosure */}
      {post.paid_partnership_brand && (
        <div className="px-4 pb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[11px] font-semibold">
            <Tag className="w-3 h-3 text-blue-400" />
            <span>Paid partnership with {post.paid_partnership_brand}</span>
          </div>
        </div>
      )}

      {/* Caption & Instant Translate */}
      {post.caption && (
        <div className="px-4 pb-3">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-white/90">
            {translatedCaption && !showOriginalCaption ? translatedCaption : post.caption}
          </p>

          <button
            onClick={handleTranslateCaption}
            disabled={isTranslatingCaption}
            className="mt-1.5 text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-medium transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>
              {isTranslatingCaption
                ? 'Translating with Gemini...'
                : translatedCaption && !showOriginalCaption
                ? 'See original'
                : 'Translate'}
            </span>
          </button>
        </div>
      )}

      {/* Media with Paywall Overlay */}
      {post.media_url && (
        <div className="relative bg-black overflow-hidden">
          {/* If paywalled, blur heavily */}
          <div className={isPaywalled ? 'blur-2xl scale-105 pointer-events-none select-none filter' : ''}>
            {post.media_type === 'video' ? (
              <video
                src={post.media_url}
                controls={!isPaywalled}
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
          </div>

          {post.media_type === 'video' && !isPaywalled && (
            <div className="pointer-events-none absolute top-3 left-3 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-xs flex items-center gap-1 text-white">
              <Play className="w-3 h-3 fill-white" /> Video
            </div>
          )}

          {/* Paywall Overlay */}
          {isPaywalled && (
            <PaywallOverlay
              author={post.author}
              onSubscribeClick={() => setShowSubscribeModal(true)}
            />
          )}
        </div>
      )}

      {/* Action Bar & Realtime Engagement Metrics */}
      <div className="px-4 py-3">
        {/* Emoji Reactions Bar */}
        <div className="flex items-center gap-1 mb-2.5 overflow-x-auto no-scrollbar">
          {REACTIONS.map((r) => {
            const count = counts[r.key] ?? 0;
            const active = my.has(r.key);
            return (
              <button
                key={r.key}
                onClick={() => react(r.key)}
                className={`group relative flex items-center gap-1 px-2.5 py-1.5 rounded-full transition active:scale-90 ${
                  active
                    ? 'bg-pink-500/20 ring-1 ring-pink-500/40 text-pink-300'
                    : 'hover:bg-white/5 bg-white/[0.02]'
                }`}
                aria-label={`${r.label} reaction`}
                aria-pressed={active}
              >
                <span className={`text-base leading-none ${active ? 'animate-pop' : ''}`}>
                  {r.glyph}
                </span>
                {count > 0 && (
                  <span className="text-xs text-white/70 tabular-nums font-medium">
                    {prettyCount(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detailed Metrics Summary Row */}
        <div className="flex items-center justify-between text-xs text-white/50 py-1 border-b border-white/5">
          <button
            onClick={() => engagement.openReactionsModal()}
            className="flex items-center gap-1.5 hover:text-white transition group"
          >
            {topEmojis.length > 0 && (
              <span className="flex items-center -space-x-1 mr-1">
                {topEmojis.map((r) => (
                  <span key={r.key} className="text-sm">
                    {r.glyph}
                  </span>
                ))}
              </span>
            )}
            <span className="tabular-nums font-medium text-white/80 group-hover:underline">
              {prettyCount(totalReactions)} reactions
            </span>
          </button>

          <div className="flex items-center gap-3">
            {/* Views counter */}
            <span className="flex items-center gap-1 text-white/60 tabular-nums font-medium" title="Views & Impressions">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>{prettyCount(engagement.viewsCount)} views</span>
            </span>

            {/* Total Engagement Rate % */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/20 text-pink-300 font-semibold"
              title="Total Engagement Rate %"
            >
              <Sparkles className="w-3 h-3 text-pink-400" />
              <span>{engagement.engagementRate}% ER</span>
            </span>
          </div>
        </div>

        {/* Interaction Actions */}
        <div className="flex items-center justify-between mt-3 pt-1">
          <div className="flex items-center gap-4">
            <button
              onClick={openComments}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
            >
              <MessageCircle className="w-4 h-4 text-white/70" />
              <span className="tabular-nums font-medium">{prettyCount(commentCount)}</span>
              <span className="hidden xs:inline text-xs">Comments</span>
            </button>

            <button
              onClick={share}
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Link2 className="w-4 h-4 text-white/70" />
              )}
              <span className="tabular-nums font-medium">{prettyCount(shareCount)}</span>
              <span className="text-xs">{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>

          {/* Bookmark / Save Action */}
          <button
            onClick={engagement.handleToggleSave}
            className={`flex items-center gap-1.5 text-sm py-1 px-2.5 rounded-xl transition ${
              engagement.isSaved
                ? 'bg-amber-500/20 text-amber-300 font-medium'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
            aria-label={engagement.isSaved ? 'Remove bookmark' : 'Save bookmark'}
          >
            <Bookmark
              className={`w-4 h-4 ${engagement.isSaved ? 'fill-amber-400 text-amber-400' : ''}`}
            />
            <span className="tabular-nums text-xs">{prettyCount(engagement.saveCount)}</span>
          </button>
        </div>
      </div>

      {/* Collaborator footer */}
      {post.collaborators.length > 0 && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-1.5 text-[11px] text-white/40">
          <Users className="w-3 h-3" />
          Co-created with {post.collaborators.map((c) => `@${c.username}`).join(', ')}
        </div>
      )}

      {/* Comments Modal */}
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
            comments.map((c) => {
              const cOnline = isUserOnline(c.author.id, c.author);
              const cStatus = formatRelativeActiveTime(
                c.author.last_seen,
                cOnline,
                c.author.show_online_status,
              );
              const supporterTier = (c.author as any).supporter_tier as SubscriptionTier | undefined;
              const isCommentTranslated = !!translatedComments[c.id];

              return (
                <div key={c.id} className="flex gap-2.5">
                  <button onClick={() => onOpenProfile?.(c.author.id)}>
                    <Avatar
                      profile={c.author}
                      size="sm"
                      showStatus
                      isOnline={cOnline}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onOpenProfile?.(c.author.id)}
                          className="text-xs font-semibold text-white/80 hover:underline"
                        >
                          @{c.author.username}
                        </button>
                        {/* Supporter Tier Badge on Commenter */}
                        {supporterTier && TIER_CONFIG[supporterTier] && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            title={`${TIER_CONFIG[supporterTier].name} Supporter`}
                          >
                            <span>{TIER_CONFIG[supporterTier].badge}</span>
                            <span>{TIER_CONFIG[supporterTier].name}</span>
                          </span>
                        )}
                        {cOnline && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Online" />
                        )}
                        <span className="text-[10px] text-white/40">
                          {cStatus.label}
                        </span>
                      </div>
                      <p className="text-sm break-words mt-0.5 text-white/90">
                        {isCommentTranslated ? translatedComments[c.id] : c.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-2">
                      <span className="text-[11px] text-white/30">{timeAgo(c.created_at)}</span>
                      <button
                        onClick={() => handleTranslateComment(c.id, c.body)}
                        className="text-[11px] text-pink-400/80 hover:text-pink-300 flex items-center gap-1"
                      >
                        <Languages className="w-2.5 h-2.5" />
                        <span>{isCommentTranslated ? 'Original' : 'Translate'}</span>
                      </button>
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
              );
            })
          )}
        </div>

        {commentError && (
          <div className="mb-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{commentError}</span>
          </div>
        )}

        <form onSubmit={submitComment} className="flex items-center gap-2 sticky bottom-0 bg-[#14141b] pt-2">
          {profile && <Avatar profile={profile} size="sm" showStatus isOnline={true} />}
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
            aria-label="Send comment"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Modal>

      {/* Reactions Modal */}
      <ReactionsModal
        open={engagement.reactionsModalOpen}
        onClose={() => engagement.setReactionsModalOpen(false)}
        reactions={engagement.reactionsList}
        loading={engagement.loadingReactions}
        onToggleFollow={engagement.toggleUserFollowInList}
        onOpenProfile={onOpenProfile}
      />

      {/* Insights Bottom Sheet Modal */}
      <PostInsightsModal
        open={engagement.insightsOpen}
        onClose={() => engagement.setInsightsOpen(false)}
        insights={engagement.insights}
        loading={engagement.loadingInsights}
      />

      {/* Creator Subscription Modal */}
      <SubscribeModal
        creator={post.author}
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onSuccess={() => setIsSubscribed(true)}
      />
    </article>
  );
}
