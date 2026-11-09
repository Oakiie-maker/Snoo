import { useState, useEffect, useRef, useCallback } from 'react';
import {
  recordPostView,
  recordReelView,
  togglePostSave,
  toggleReelSave,
  fetchPostReactionsBreakdown,
  fetchPostInsights,
  toggleFollow,
} from '@/lib/api';
import type { PostWithMeta, ReactionDetailUser, PostInsights, ReactionEmoji } from '@/lib/types';

export function calculateEngagementRate(
  reactions: number,
  comments: number,
  shares: number,
  saves: number,
  views: number,
): number {
  const total = reactions + comments + shares + saves;
  return Number(((total / Math.max(views, 1)) * 100).toFixed(1));
}

interface UsePostEngagementOptions {
  post: PostWithMeta;
  userId?: string;
  onPostUpdated?: (updated: PostWithMeta) => void;
}

export function usePostEngagement({ post, userId, onPostUpdated }: UsePostEngagementOptions) {
  const [viewsCount, setViewsCount] = useState(post.views_count);
  const [saveCount, setSaveCount] = useState(post.save_count);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [engagementRate, setEngagementRate] = useState(post.engagement_rate);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [reactionsList, setReactionsList] = useState<ReactionDetailUser[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insights, setInsights] = useState<PostInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const containerRef = useRef<HTMLElement | null>(null);
  const hasRecordedViewRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setViewsCount(post.views_count);
    setSaveCount(post.save_count);
    setIsSaved(post.is_saved);
    setEngagementRate(post.engagement_rate);
  }, [post]);

  // Track impressions (>1s in viewport)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hasRecordedViewRef.current || !userId) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          if (!timerRef.current && !hasRecordedViewRef.current) {
            timerRef.current = window.setTimeout(async () => {
              hasRecordedViewRef.current = true;
              await recordPostView(post.id, userId, 1200);
              setViewsCount((v) => {
                const next = v + 1;
                const totalRx = Object.values(post.reaction_counts).reduce((a, b) => a + b, 0);
                setEngagementRate(
                  calculateEngagementRate(totalRx, post.comment_count, post.share_count, post.save_count, next),
                );
                return next;
              });
            }, 1000);
          }
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [post.id, userId, post.reaction_counts, post.comment_count, post.share_count, post.save_count]);

  const handleToggleSave = useCallback(async () => {
    if (!userId) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setSaveCount((c) => Math.max(0, c + (nextSaved ? 1 : -1)));
    const totalRx = Object.values(post.reaction_counts).reduce((a, b) => a + b, 0);
    const nextSaveCount = Math.max(0, saveCount + (nextSaved ? 1 : -1));
    setEngagementRate(
      calculateEngagementRate(totalRx, post.comment_count, post.share_count, nextSaveCount, viewsCount),
    );
    await togglePostSave(post.id, userId, isSaved);
  }, [isSaved, userId, post.id, post.reaction_counts, post.comment_count, post.share_count, saveCount, viewsCount]);

  const openReactionsModal = useCallback(async (initialEmoji?: ReactionEmoji) => {
    setReactionsModalOpen(true);
    setLoadingReactions(true);
    if (userId) {
      const breakdown = await fetchPostReactionsBreakdown(post.id, userId);
      setReactionsList(breakdown);
    }
    setLoadingReactions(false);
  }, [post.id, userId]);

  const openInsightsModal = useCallback(async () => {
    setInsightsOpen(true);
    setLoadingInsights(true);
    const data = await fetchPostInsights(post);
    setInsights(data);
    setLoadingInsights(false);
  }, [post]);

  const toggleUserFollowInList = useCallback(
    async (targetUserId: string, currentFollowing: boolean) => {
      if (!userId) return;
      setReactionsList((prev) =>
        prev.map((item) =>
          item.profile.id === targetUserId
            ? { ...item, is_following: !currentFollowing }
            : item,
        ),
      );
      await toggleFollow(userId, targetUserId, !currentFollowing);
    },
    [userId],
  );

  return {
    containerRef,
    viewsCount,
    saveCount,
    isSaved,
    engagementRate,
    reactionsModalOpen,
    setReactionsModalOpen,
    reactionsList,
    loadingReactions,
    openReactionsModal,
    insightsOpen,
    setInsightsOpen,
    insights,
    loadingInsights,
    openInsightsModal,
    handleToggleSave,
    toggleUserFollowInList,
  };
}
