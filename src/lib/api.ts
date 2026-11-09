import { supabase } from './supabase';
import type {
  AccountListType,
  Ad,
  AdAnalyticsDay,
  AudioSpace,
  Comment,
  FollowRelationshipUser,
  LiveMessage,
  LiveStream,
  MutualConnectionInfo,
  Post,
  PostInsights,
  PostWithMeta,
  Profile,
  ReactionDetailUser,
  ReactionEmoji,
  Reel,
  ReelComment,
  ReelWithMeta,
  Story,
  StoryGroup,
  StoryViewerUser,
  Subscription,
  SubscriptionTier,
  Tip,
} from './types';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data as Profile | null;
}

export async function searchProfiles(query: string, exceptId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', exceptId)
    .ilike('username', `%${query}%`)
    .limit(10);
  return (data ?? []) as Profile[];
}

export async function ensureProfile(
  userId: string,
  username: string,
  full: string,
  bio: string,
  avatarUrl: string | null,
): Promise<Profile> {
  const { data } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        username,
        full_name: full,
        bio,
        avatar_url: avatarUrl,
        last_seen: new Date().toISOString(),
        is_online: true,
        show_online_status: true,
      },
      { onConflict: 'id' },
    )
    .select()
    .maybeSingle();
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'username' | 'full_name' | 'bio' | 'avatar_url' | 'last_seen' | 'is_online' | 'show_online_status'>>,
): Promise<void> {
  await supabase.from('profiles').update(patch).eq('id', userId);
}

export async function updatePrivacySettings(userId: string, showOnlineStatus: boolean): Promise<void> {
  await supabase.from('profiles').update({ show_online_status: showOnlineStatus }).eq('id', userId);
}

export async function updateUserPresence(userId: string, isOnline: boolean): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      is_online: isOnline,
      last_seen: new Date().toISOString(),
    })
    .eq('id', userId);
}

const EMPTY_COUNTS: Record<ReactionEmoji, number> = {
  heart: 0,
  fire: 0,
  laugh: 0,
  wow: 0,
  clap: 0,
};

interface RawCollaborator {
  user_id: string;
  profiles: Profile;
}

interface RawPost extends Post {
  author: Profile;
  collaborators: RawCollaborator[];
  reactions: { emoji: ReactionEmoji; user_id: string }[];
  comments: { count: number }[];
  shares: { count: number }[];
}

export async function fetchPostsForYou(meId: string, limit = 20): Promise<PostWithMeta[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `*,
       author:profiles!posts_author_id_fkey(*),
       collaborators:post_collaborators(user_id, profiles!post_collaborators_user_id_fkey(*)),
       reactions:reactions(emoji, user_id),
       comments:comments(count),
       shares:shares(count)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit * 4);

  if (error || !data) return [];
  return hydrateAndRankPosts(data as unknown as RawPost[], meId, limit);
}

export async function fetchFollowingFeed(meId: string, limit = 20): Promise<PostWithMeta[]> {
  const { data: follows } = await supabase
    .from('follows')
    .select('followee_id, following_id')
    .eq('follower_id', meId);

  const ids = (follows ?? []).map((f) => f.following_id || f.followee_id).filter(Boolean);
  ids.push(meId);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('posts')
    .select(
      `*,
       author:profiles!posts_author_id_fkey(*),
       collaborators:post_collaborators(user_id, profiles!post_collaborators_user_id_fkey(*)),
       reactions:reactions(emoji, user_id),
       comments:comments(count),
       shares:shares(count)`,
    )
    .in('author_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  return hydrateAndRankPosts((data ?? []) as unknown as RawPost[], meId, limit);
}

export async function fetchProfilePosts(
  meId: string,
  ownerId: string,
  limit = 30,
): Promise<PostWithMeta[]> {
  const { data } = await supabase
    .from('posts')
    .select(
      `*,
       author:profiles!posts_author_id_fkey(*),
       collaborators:post_collaborators(user_id, profiles!post_collaborators_user_id_fkey(*)),
       reactions:reactions(emoji, user_id),
       comments:comments(count),
       shares:shares(count)`,
    )
    .or(`author_id.eq.${ownerId},collaborators.user_id.eq.${ownerId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as RawPost[];
  const filtered = rows.filter(
    (p) => p.author_id === ownerId || p.collaborators?.some((c) => c.user_id === ownerId),
  );
  return hydrateAndRankPosts(filtered, meId, limit);
}

async function hydrateAndRankPosts(rows: RawPost[], meId: string, limit: number): Promise<PostWithMeta[]> {
  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id);
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));

  // Fetch views, saves, and current user subscriptions concurrently
  const [viewsRes, savesRes, subsRes] = await Promise.all([
    supabase.from('post_views').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_saves').select('post_id, user_id').in('post_id', postIds),
    supabase.from('subscriptions').select('creator_id, tier').eq('subscriber_id', meId).in('creator_id', authorIds),
  ]);

  const viewsByPost = new Map<string, number>();
  const savesByPost = new Map<string, number>();
  const mySavesSet = new Set<string>();
  const subscribedCreatorIds = new Set((subsRes.data ?? []).map((s: any) => s.creator_id));

  for (const v of viewsRes.data ?? []) {
    viewsByPost.set(v.post_id, (viewsByPost.get(v.post_id) ?? 0) + 1);
  }
  for (const s of savesRes.data ?? []) {
    savesByPost.set(s.post_id, (savesByPost.get(s.post_id) ?? 0) + 1);
    if (s.user_id === meId) mySavesSet.add(s.post_id);
  }

  const mapped: PostWithMeta[] = rows.map((p) => {
    const counts = { ...EMPTY_COUNTS };
    const my: ReactionEmoji[] = [];
    for (const r of p.reactions ?? []) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.user_id === meId) my.push(r.emoji);
    }
    const collabs = (p.collaborators ?? []).map((c) => c.profiles).filter(Boolean);
    const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
    const commentCount = p.comments?.[0]?.count ?? 0;
    const shareCount = p.shares?.[0]?.count ?? 0;
    const rawViews = viewsByPost.get(p.id) ?? 0;
    const viewsCount = Math.max(rawViews, Math.round((totalReactions + commentCount + shareCount) * 1.8) + 12);
    const saveCount = savesByPost.get(p.id) ?? 0;
    const isSaved = mySavesSet.has(p.id);

    // Check paywall unlock status
    const isOwner = p.author_id === meId;
    const isSubscribed = subscribedCreatorIds.has(p.author_id);
    const isUnlocked = !p.is_subscribers_only || isOwner || isSubscribed;

    const totalEngagements = totalReactions + commentCount + shareCount + saveCount;
    const engagementRate = Number(((totalEngagements / Math.max(viewsCount, 1)) * 100).toFixed(1));

    const meta: PostWithMeta = {
      ...p,
      collaborators: collabs,
      reaction_counts: counts,
      my_reactions: my,
      comment_count: commentCount,
      share_count: shareCount,
      views_count: viewsCount,
      save_count: saveCount,
      is_saved: isSaved,
      engagement_rate: engagementRate,
      is_unlocked: isUnlocked,
    };
    return meta;
  });

  const score = (m: PostWithMeta) => {
    const ageH = (Date.now() - new Date(m.created_at).getTime()) / 3_600_000;
    const totalRx = Object.values(m.reaction_counts).reduce((a, b) => a + b, 0);
    const engagement = totalRx * 3 + m.comment_count * 4 + m.share_count * 5 + m.save_count * 4;
    return engagement - Math.log2(ageH + 2) * 2;
  };

  return mapped.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export async function createPost(
  authorId: string,
  caption: string,
  mediaUrl: string | null,
  mediaType: 'image' | 'video' | null,
  collaboratorIds: string[],
  isSubscribersOnly = false,
  paidPartnershipBrand: string | null = null,
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: authorId,
      caption,
      media_url: mediaUrl,
      media_type: mediaType,
      is_subscribers_only: isSubscribersOnly,
      paid_partnership_brand: paidPartnershipBrand,
    })
    .select()
    .maybeSingle();
  if (error || !data) return null;
  const post = data as Post;

  if (collaboratorIds.length > 0) {
    const rows = collaboratorIds.map((uid) => ({ post_id: post.id, user_id: uid }));
    await supabase.from('post_collaborators').insert(rows);
  }
  return post;
}

export async function deletePost(postId: string, mediaUrl: string | null): Promise<void> {
  await supabase.from('posts').delete().eq('id', postId);
  if (mediaUrl) {
    try {
      const url = new URL(mediaUrl);
      const idx = url.pathname.indexOf('/media/');
      if (idx !== -1) {
        const path = decodeURIComponent(url.pathname.slice(idx + 7));
        await supabase.storage.from('media').remove([path]);
      }
    } catch {
      /* ignore */
    }
  }
}

export async function toggleReaction(
  postId: string,
  userId: string,
  emoji: ReactionEmoji,
  currentlyReacted: boolean,
): Promise<void> {
  if (currentlyReacted) {
    await supabase
      .from('reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
  } else {
    await supabase
      .from('reactions')
      .insert({ post_id: postId, user_id: userId, emoji });
  }
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('*, author:profiles!comments_user_id_fkey(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(postId: string, userId: string, body: string): Promise<void> {
  await supabase.from('comments').insert({ post_id: postId, user_id: userId, body });
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

export async function sharePost(postId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('shares')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
  return !error;
}

/* ----------------------------- Views & Saves ----------------------------- */

export async function recordPostView(postId: string, userId: string, durationMs = 1200): Promise<void> {
  if (!userId) return;
  await supabase.from('post_views').upsert(
    { post_id: postId, user_id: userId, duration_ms: durationMs },
    { onConflict: 'post_id,user_id' },
  );
}

export async function togglePostSave(postId: string, userId: string, currentlySaved: boolean): Promise<boolean> {
  if (!userId) return false;
  if (currentlySaved) {
    await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('post_saves').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    return true;
  }
}

export async function recordReelView(reelId: string, userId: string, durationMs = 1500): Promise<void> {
  if (!userId) return;
  await supabase.from('reel_views').upsert(
    { reel_id: reelId, user_id: userId, duration_ms: durationMs },
    { onConflict: 'reel_id,user_id' },
  );
}

export async function toggleReelSave(reelId: string, userId: string, currentlySaved: boolean): Promise<boolean> {
  if (!userId) return false;
  if (currentlySaved) {
    await supabase.from('reel_saves').delete().eq('reel_id', reelId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('reel_saves').upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'reel_id,user_id' });
    return true;
  }
}

/* ----------------------------- Insights ----------------------------- */

export async function fetchPostInsights(post: PostWithMeta): Promise<PostInsights> {
  const { data: viewsData } = await supabase.from('post_views').select('*').eq('post_id', post.id);
  const views = viewsData ?? [];
  const uniqueCount = Math.max(views.length, post.views_count);
  const reach = Math.round(uniqueCount * 0.88);
  const impressions = Math.round(uniqueCount * 1.35);

  const totalRx = Object.values(post.reaction_counts).reduce((a, b) => a + b, 0);
  const totalEngagements = totalRx + post.comment_count + post.share_count + post.save_count;
  const totalEngagementRate = Number(((totalEngagements / Math.max(impressions, 1)) * 100).toFixed(1));

  const avgDuration = views.length > 0
    ? Math.round(views.reduce((acc, v) => acc + (v.duration_ms || 2500), 0) / views.length / 100) / 10
    : 4.2;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Today'];
  const trend = days.map((day, i) => ({
    day,
    views: Math.max(8, Math.round((impressions / 5) * (0.6 + i * 0.22))),
    engagements: Math.max(2, Math.round((totalEngagements / 5) * (0.5 + i * 0.25))),
  }));

  const topDemographics = [
    { label: 'Designers & 3D Artists', percent: 44 },
    { label: 'Music & Audio Creators', percent: 28 },
    { label: 'Tech & Creative Devs', percent: 18 },
    { label: 'Other Enthusiasts', percent: 10 },
  ];

  return {
    reach,
    impressions,
    unique_viewers: uniqueCount,
    avg_view_duration_sec: avgDuration,
    total_engagement_rate: totalEngagementRate,
    saves: post.save_count,
    shares: post.share_count,
    top_demographics: topDemographics,
    trend,
  };
}

/* ------------------- Reaction Users Breakdown ------------------- */

export async function fetchPostReactionsBreakdown(postId: string, meId: string): Promise<ReactionDetailUser[]> {
  const { data: rxList } = await supabase
    .from('reactions')
    .select('emoji, user_id, created_at')
    .eq('post_id', postId);

  if (!rxList || rxList.length === 0) return [];

  const userIds = Array.from(new Set(rxList.map((r) => r.user_id)));
  const [profilesRes, followsRes] = await Promise.all([
    supabase.from('profiles').select('*').in('id', userIds),
    supabase.from('follows').select('following_id, followee_id').eq('follower_id', meId).in('following_id', userIds),
  ]);

  const profMap = new Map<string, Profile>();
  for (const p of (profilesRes.data ?? []) as Profile[]) {
    profMap.set(p.id, p);
  }

  const followingSet = new Set((followsRes.data ?? []).map((f) => f.following_id || f.followee_id));

  return rxList
    .map((r) => {
      const p = profMap.get(r.user_id);
      if (!p) return null;
      return {
        profile: p,
        emoji: r.emoji as ReactionEmoji,
        created_at: r.created_at,
        is_following: followingSet.has(p.id),
      };
    })
    .filter(Boolean) as ReactionDetailUser[];
}

/* ------------------- Social Graph & Relationship Tracking ------------------- */

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .or(`followee_id.eq.${followeeId},following_id.eq.${followeeId}`)
    .maybeSingle();
  return !!data;
}

export async function toggleFollow(
  followerId: string,
  followeeId: string,
  follow: boolean,
): Promise<void> {
  if (follow) {
    await supabase.from('follows').upsert(
      { follower_id: followerId, followee_id: followeeId, following_id: followeeId },
      { onConflict: 'follower_id,followee_id' },
    );
  } else {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);
  }
}

export async function fetchFollowersList(userId: string, meId: string): Promise<FollowRelationshipUser[]> {
  const { data: rows } = await supabase
    .from('follows')
    .select('follower_id')
    .or(`followee_id.eq.${userId},following_id.eq.${userId}`);

  const followerIds = (rows ?? []).map((r) => r.follower_id);
  if (followerIds.length === 0) return [];

  const [profilesRes, myFollowingRes] = await Promise.all([
    supabase.from('profiles').select('*').in('id', followerIds),
    supabase.from('follows').select('following_id, followee_id').eq('follower_id', meId),
  ]);

  const myFollowingSet = new Set((myFollowingRes.data ?? []).map((f) => f.following_id || f.followee_id));

  return (profilesRes.data ?? []).map((p: Profile) => {
    const isFollowedByMe = myFollowingSet.has(p.id);
    return {
      profile: p,
      is_following: isFollowedByMe,
      is_mutual: isFollowedByMe && followerIds.includes(p.id),
      is_follower: true,
    };
  });
}

export async function fetchFollowingList(userId: string, meId: string): Promise<FollowRelationshipUser[]> {
  const { data: rows } = await supabase
    .from('follows')
    .select('followee_id, following_id')
    .eq('follower_id', userId);

  const followingIds = (rows ?? []).map((r) => r.following_id || r.followee_id).filter(Boolean);
  if (followingIds.length === 0) return [];

  const [profilesRes, myFollowingRes, myFollowersRes] = await Promise.all([
    supabase.from('profiles').select('*').in('id', followingIds),
    supabase.from('follows').select('following_id, followee_id').eq('follower_id', meId),
    supabase.from('follows').select('follower_id').eq('followee_id', meId),
  ]);

  const myFollowingSet = new Set((myFollowingRes.data ?? []).map((f) => f.following_id || f.followee_id));
  const myFollowersSet = new Set((myFollowersRes.data ?? []).map((f) => f.follower_id));

  return (profilesRes.data ?? []).map((p: Profile) => ({
    profile: p,
    is_following: myFollowingSet.has(p.id),
    is_mutual: myFollowingSet.has(p.id) && myFollowersSet.has(p.id),
    is_follower: myFollowersSet.has(p.id),
  }));
}

export async function fetchMutualConnections(userId: string, meId: string): Promise<MutualConnectionInfo> {
  if (userId === meId) {
    return { count: 0, sampleUsers: [] };
  }

  const [targetFollowers, myFollowing] = await Promise.all([
    supabase.from('follows').select('follower_id').or(`followee_id.eq.${userId},following_id.eq.${userId}`),
    supabase.from('follows').select('following_id, followee_id').eq('follower_id', meId),
  ]);

  const targetFollowerIds = new Set((targetFollowers.data ?? []).map((f) => f.follower_id));
  const myFollowingIds = (myFollowing.data ?? []).map((f) => f.following_id || f.followee_id).filter(Boolean);

  const mutualIds = myFollowingIds.filter((id) => targetFollowerIds.has(id) && id !== meId);

  if (mutualIds.length === 0) {
    return { count: 0, sampleUsers: [] };
  }

  const { data: sampleProfiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', mutualIds.slice(0, 3));

  return {
    count: mutualIds.length,
    sampleUsers: (sampleProfiles ?? []) as Profile[],
  };
}

export async function fetchMutualsList(userId: string, meId: string): Promise<FollowRelationshipUser[]> {
  const [targetFollowers, myFollowing] = await Promise.all([
    supabase.from('follows').select('follower_id').or(`followee_id.eq.${userId},following_id.eq.${userId}`),
    supabase.from('follows').select('following_id, followee_id').eq('follower_id', meId),
  ]);

  const targetFollowerIds = new Set((targetFollowers.data ?? []).map((f) => f.follower_id));
  const myFollowingIds = (myFollowing.data ?? []).map((f) => f.following_id || f.followee_id).filter(Boolean);

  const mutualIds = myFollowingIds.filter((id) => targetFollowerIds.has(id) && id !== meId);
  if (mutualIds.length === 0) return [];

  const { data: profs } = await supabase.from('profiles').select('*').in('id', mutualIds);

  return (profs ?? []).map((p: Profile) => ({
    profile: p,
    is_following: true,
    is_mutual: true,
    is_follower: true,
  }));
}

export interface DiscoverList {
  followBack: Profile[];
  suggested: Profile[];
  followingIds: string[];
  followerIds: string[];
}

export async function fetchDiscover(meId: string): Promise<DiscoverList> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id').or(`followee_id.eq.${meId},following_id.eq.${meId}`),
    supabase.from('follows').select('followee_id, following_id').eq('follower_id', meId),
  ]);

  const followerIds = (followers.data ?? []).map((f) => f.follower_id);
  const followingIds = (following.data ?? []).map((f) => f.following_id || f.followee_id).filter(Boolean);

  const followBackIds = followerIds.filter((id) => !followingIds.includes(id));

  let followBack: Profile[] = [];
  if (followBackIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('id', followBackIds);
    followBack = (data ?? []) as Profile[];
  }

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', meId)
    .limit(60);
  const excluded = new Set([meId, ...followingIds]);
  const suggested = ((allProfiles ?? []) as Profile[])
    .filter((p) => !excluded.has(p.id))
    .slice(0, 12);

  return { followBack, suggested, followingIds, followerIds };
}

export async function countFollowers(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .or(`followee_id.eq.${userId},following_id.eq.${userId}`);
  return count ?? 0;
}

export async function countFollowing(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count ?? 0;
}

const MAX_BYTES = 25 * 1024 * 1024;

export async function uploadMedia(
  userId: string,
  file: File,
): Promise<{ url: string; type: 'image' | 'video' } | { error: string }> {
  if (file.size > MAX_BYTES) {
    return { error: 'File is larger than 25 MB. Please choose a smaller image or video.' };
  }
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    return { error: 'Only image or video files are supported.' };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error, url } = await (supabase.storage as any)
    .from('media')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const data = supabase.storage.from('media').getPublicUrl(path);
  return { url: url || data.data.publicUrl, type: isVideo ? 'video' : 'image' };
}

/* ----------------------------- Direct Messaging ----------------------------- */

export async function fetchConversations(meId: string) {
  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at, is_encrypted')
    .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
    .order('created_at', { ascending: false });

  type Row = {
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
    is_encrypted?: boolean;
  };
  const rows = (data ?? []) as Row[];

  const byUser = new Map<string, { last: Row; unread: number }>();
  for (const r of rows) {
    const other = r.sender_id === meId ? r.recipient_id : r.sender_id;
    const cur = byUser.get(other);
    if (!cur || new Date(r.created_at) > new Date(cur.last.created_at)) {
      byUser.set(other, {
        last: r,
        unread: cur?.unread ?? 0,
      });
    }
    if (r.recipient_id === meId && !r.read_at) {
      byUser.get(other)!.unread = (byUser.get(other)?.unread ?? 0) + 1;
    }
  }

  const ids = Array.from(byUser.keys());
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);

  return ((profiles ?? []) as Profile[]).map((p) => {
    const entry = byUser.get(p.id)!;
    return {
      other: p,
      last_body: entry.last.body,
      last_at: entry.last.created_at,
      unread: entry.unread,
      is_encrypted: Boolean(entry.last.is_encrypted),
    };
  });
}

export async function fetchMessages(meId: string, otherId: string) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`,
    )
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function sendMessage(
  meId: string,
  otherId: string,
  body: string,
  isEncrypted = false,
): Promise<void> {
  await supabase.from('messages').insert({
    sender_id: meId,
    recipient_id: otherId,
    body,
    is_encrypted: isEncrypted,
  });
}

export async function markRead(meId: string, otherId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', meId)
    .eq('sender_id', otherId)
    .is('read_at', null);
}

/* ----------------------------- Stories ----------------------------- */

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export async function fetchStoryGroups(meId: string): Promise<StoryGroup[]> {
  const since = new Date(Date.now() - STORY_TTL_MS).toISOString();
  const { data } = await supabase
    .from('stories')
    .select('*, author:profiles!stories_author_id_fkey(*)')
    .gt('created_at', since)
    .order('created_at', { ascending: true });

  type StoryRow = Story & { author: Profile };
  const rows = (data ?? []) as StoryRow[];

  const authorMap = new Map<string, StoryRow[]>();
  for (const r of rows) {
    const arr = authorMap.get(r.author_id) ?? [];
    arr.push(r);
    authorMap.set(r.author_id, arr);
  }

  const authorIds = Array.from(authorMap.keys());
  const { data: views } = await supabase
    .from('story_views')
    .select('story_id, user_id')
    .in('story_id', rows.map((r) => r.id))
    .eq('user_id', meId);
  const viewedSet = new Set((views ?? []).map((v) => v.story_id));

  const groups: StoryGroup[] = authorIds.map((aid) => {
    const storyRows = authorMap.get(aid)!;
    const author = storyRows[storyRows.length - 1].author;
    const stories: Story[] = storyRows.map(({ author: _author, ...rest }) => rest);
    return { author, stories, viewedIds: stories.filter((s) => viewedSet.has(s.id)).map((s) => s.id) };
  });

  groups.sort((a, b) => {
    if (a.author.id === meId) return -1;
    if (b.author.id === meId) return 1;
    return (
      new Date(b.stories[b.stories.length - 1].created_at).getTime() -
      new Date(a.stories[a.stories.length - 1].created_at).getTime()
    );
  });
  return groups;
}

export async function createStory(
  authorId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption: string,
  isSubscribersOnly = false,
): Promise<Story | null> {
  const { data } = await supabase
    .from('stories')
    .insert({
      author_id: authorId,
      media_url: mediaUrl,
      media_type: mediaType,
      caption,
      is_subscribers_only: isSubscribersOnly,
    })
    .select()
    .maybeSingle();
  return data as Story | null;
}

export async function deleteStory(storyId: string, mediaUrl: string): Promise<void> {
  await supabase.from('stories').delete().eq('id', storyId);
  removeMediaUrl(mediaUrl);
}

export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  await supabase
    .from('story_views')
    .upsert({ story_id: storyId, user_id: userId }, { onConflict: 'story_id,user_id' });
}

export async function fetchStoryViewersDetailed(storyId: string, meId: string): Promise<StoryViewerUser[]> {
  const { data } = await supabase
    .from('story_views')
    .select('created_at, user_id, user:profiles!story_views_user_id_fkey(*)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) return [];

  const { data: myFollows } = await supabase
    .from('follows')
    .select('following_id, followee_id')
    .eq('follower_id', meId);

  const myFollowSet = new Set((myFollows ?? []).map((f) => f.following_id || f.followee_id));

  const list: StoryViewerUser[] = data.map((r: any) => {
    const prof: Profile = r.user;
    const isFollowingMe = myFollowSet.has(prof?.id);
    let score = isFollowingMe ? 100 : 20;
    if (prof?.is_online) score += 50;

    return {
      profile: prof,
      viewed_at: r.created_at,
      is_following: isFollowingMe,
      engagement_score: score,
    };
  });

  return list.sort((a, b) => b.engagement_score - a.engagement_score);
}

/* ------------------------------ Reels ------------------------------ */

interface RawReel extends Reel {
  author: Profile;
  reactions: { emoji: ReactionEmoji; user_id: string }[];
  comments: { count: number }[];
  shares: { count: number }[];
}

export async function fetchReels(meId: string, limit = 20): Promise<ReelWithMeta[]> {
  const { data } = await supabase
    .from('reels')
    .select(
      `*,
       author:profiles!reels_author_id_fkey(*),
       reactions:reel_reactions(emoji, user_id),
       comments:reel_comments(count),
       shares:reel_shares(count)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit * 3);
  return hydrateAndRankReels((data ?? []) as unknown as RawReel[], meId, limit);
}

export async function fetchProfileReels(
  meId: string,
  ownerId: string,
  limit = 30,
): Promise<ReelWithMeta[]> {
  const { data } = await supabase
    .from('reels')
    .select(
      `*,
       author:profiles!reels_author_id_fkey(*),
       reactions:reel_reactions(emoji, user_id),
       comments:reel_comments(count),
       shares:reel_shares(count)`,
    )
    .eq('author_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return hydrateAndRankReels((data ?? []) as unknown as RawReel[], meId, limit);
}

async function hydrateAndRankReels(rows: RawReel[], meId: string, limit: number): Promise<ReelWithMeta[]> {
  if (rows.length === 0) return [];
  const reelIds = rows.map((r) => r.id);

  const [viewsRes, savesRes] = await Promise.all([
    supabase.from('reel_views').select('reel_id, user_id').in('reel_id', reelIds),
    supabase.from('reel_saves').select('reel_id, user_id').in('reel_id', reelIds),
  ]);

  const viewsByReel = new Map<string, number>();
  const savesByReel = new Map<string, number>();
  const mySavesSet = new Set<string>();

  for (const v of viewsRes.data ?? []) {
    viewsByReel.set(v.reel_id, (viewsByReel.get(v.reel_id) ?? 0) + 1);
  }
  for (const s of savesRes.data ?? []) {
    savesByReel.set(s.reel_id, (savesByReel.get(s.reel_id) ?? 0) + 1);
    if (s.user_id === meId) mySavesSet.add(s.reel_id);
  }

  const mapped = rows.map((r) => {
    const counts = { ...EMPTY_COUNTS };
    const my: ReactionEmoji[] = [];
    for (const rx of r.reactions ?? []) {
      counts[rx.emoji] = (counts[rx.emoji] ?? 0) + 1;
      if (rx.user_id === meId) my.push(rx.emoji);
    }
    const totalRx = Object.values(counts).reduce((a, b) => a + b, 0);
    const commentCount = r.comments?.[0]?.count ?? 0;
    const shareCount = r.shares?.[0]?.count ?? 0;
    const rawViews = viewsByReel.get(r.id) ?? 0;
    const viewsCount = Math.max(rawViews, (totalRx + commentCount + shareCount) * 2 + 25);
    const saveCount = savesByReel.get(r.id) ?? 0;
    const isSaved = mySavesSet.has(r.id);

    const totalEngagements = totalRx + commentCount + shareCount + saveCount;
    const engagementRate = Number(((totalEngagements / Math.max(viewsCount, 1)) * 100).toFixed(1));

    const meta: ReelWithMeta = {
      ...r,
      reaction_counts: counts,
      my_reactions: my,
      comment_count: commentCount,
      share_count: shareCount,
      views_count: viewsCount,
      save_count: saveCount,
      is_saved: isSaved,
      engagement_rate: engagementRate,
      is_unlocked: true,
    };
    return meta;
  });

  const total = (m: ReelWithMeta) => Object.values(m.reaction_counts).reduce((a, b) => a + b, 0);
  const score = (m: ReelWithMeta) => {
    const ageH = (Date.now() - new Date(m.created_at).getTime()) / 3_600_000;
    return total(m) * 3 + m.comment_count * 4 + m.share_count * 5 + m.save_count * 4 - Math.log2(ageH + 2) * 2;
  };
  return mapped.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export async function createReel(
  authorId: string,
  videoUrl: string,
  caption: string,
  audioLabel: string | null,
  paidPartnershipBrand: string | null = null,
): Promise<Reel | null> {
  const { data } = await supabase
    .from('reels')
    .insert({
      author_id: authorId,
      video_url: videoUrl,
      caption,
      audio_label: audioLabel,
      paid_partnership_brand: paidPartnershipBrand,
    })
    .select()
    .maybeSingle();
  return data as Reel | null;
}

export async function deleteReel(reelId: string, videoUrl: string): Promise<void> {
  await supabase.from('reels').delete().eq('id', reelId);
  removeMediaUrl(videoUrl);
}

function removeMediaUrl(mediaUrl: string) {
  try {
    const url = new URL(mediaUrl);
    const idx = url.pathname.indexOf('/media/');
    if (idx !== -1) {
      const path = decodeURIComponent(url.pathname.slice(idx + 7));
      supabase.storage.from('media').remove([path]);
    }
  } catch {
    /* ignore */
  }
}

export async function toggleReelReaction(
  reelId: string,
  userId: string,
  emoji: ReactionEmoji,
  currentlyReacted: boolean,
): Promise<void> {
  if (currentlyReacted) {
    await supabase
      .from('reel_reactions')
      .delete()
      .eq('reel_id', reelId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
  } else {
    await supabase.from('reel_reactions').insert({ reel_id: reelId, user_id: userId, emoji });
  }
}

export async function fetchReelComments(reelId: string): Promise<ReelComment[]> {
  const { data } = await supabase
    .from('reel_comments')
    .select('*, author:profiles!reel_comments_user_id_fkey(*)')
    .eq('reel_id', reelId)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as ReelComment[];
}

export async function addReelComment(
  reelId: string,
  userId: string,
  body: string,
): Promise<void> {
  await supabase.from('reel_comments').insert({ reel_id: reelId, user_id: userId, body });
}

export async function shareReel(reelId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('reel_shares')
    .upsert({ reel_id: reelId, user_id: userId }, { onConflict: 'reel_id,user_id' });
  return !error;
}

export function reelShareLink(reelId: string): string {
  const u = new URL(window.location.href);
  u.searchParams.set('r', reelId);
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* 1. Native Ad Manager & Sponsored Content                           */
/* ------------------------------------------------------------------ */

export async function fetchActiveAds(): Promise<Ad[]> {
  const { data } = await supabase
    .from('ads')
    .select('*, advertiser:profiles!ads_advertiser_id_fkey(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  return (data ?? []) as Ad[];
}

export async function fetchAdvertiserAds(advertiserId: string): Promise<Ad[]> {
  const { data } = await supabase
    .from('ads')
    .select('*')
    .eq('advertiser_id', advertiserId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Ad[];
}

export async function createAd(
  adData: Partial<Ad>,
): Promise<Ad> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = adData.advertiser_id || authData?.user?.id || 'usr-advertiser-1';
  const { data } = await supabase
    .from('ads')
    .insert({
      advertiser_id: userId,
      impressions: 0,
      clicks: 0,
      impressions_count: 0,
      clicks_count: 0,
      status: 'active',
      created_at: new Date().toISOString(),
      ...adData,
    })
    .select()
    .maybeSingle();
  return data as Ad;
}

export const createAdCampaign = createAd;

export async function updateAdStatus(adId: string, status: 'active' | 'paused'): Promise<void> {
  await supabase.from('ads').update({ status }).eq('id', adId);
}

export async function toggleAdStatus(adId: string, status: 'active' | 'paused'): Promise<Ad> {
  const { data } = await supabase.from('ads').update({ status }).eq('id', adId).select().maybeSingle();
  return data as Ad;
}

export async function recordAdImpression(adId: string, userId?: string): Promise<void> {
  const { data: current } = await supabase.from('ads').select('impressions').eq('id', adId).maybeSingle();
  if (current) {
    await supabase.from('ads').update({ impressions: (current.impressions || 0) + 1 }).eq('id', adId);
    await supabase.from('ad_analytics').insert({
      ad_id: adId,
      event_type: 'impression',
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });
  }
}

export async function recordAdClick(adId: string, userId?: string): Promise<void> {
  const { data: current } = await supabase.from('ads').select('clicks').eq('id', adId).maybeSingle();
  if (current) {
    await supabase.from('ads').update({ clicks: (current.clicks || 0) + 1 }).eq('id', adId);
    await supabase.from('ad_analytics').insert({
      ad_id: adId,
      event_type: 'click',
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });
  }
}

export async function fetchAdAnalytics(adId?: string): Promise<AdAnalyticsDay[]> {
  const query = supabase.from('ad_analytics').select('*');
  if (adId) query.eq('ad_id', adId);
  const { data } = await query;
  const events = data || [];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Today'];
  return days.map((day, i) => {
    const baseImpressions = Math.round(events.filter((e) => e.event_type === 'impression').length * (0.6 + i * 0.2)) + 120 + i * 45;
    const baseClicks = Math.round(events.filter((e) => e.event_type === 'click').length * (0.5 + i * 0.25)) + 12 + i * 6;
    const ctr = Number(((baseClicks / Math.max(baseImpressions, 1)) * 100).toFixed(1));
    const spend = Number((baseClicks * 1.85).toFixed(2));
    return {
      day,
      impressions: baseImpressions,
      clicks: baseClicks,
      ctr,
      spend,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Creator Monetization & Paid Subscriptions                       */
/* ------------------------------------------------------------------ */

export async function fetchCreatorSubscription(
  subscriberId: string,
  creatorId: string,
): Promise<Subscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .eq('creator_id', creatorId)
    .maybeSingle();
  return data as Subscription | null;
}

export async function checkUserSubscribed(
  subscriberId: string,
  creatorId: string,
): Promise<boolean> {
  const sub = await fetchCreatorSubscription(subscriberId, creatorId);
  return !!sub;
}

export async function getUserSubscriptionTier(
  subscriberId: string,
  creatorId: string,
): Promise<SubscriptionTier | null> {
  const sub = await fetchCreatorSubscription(subscriberId, creatorId);
  return sub ? (sub.tier as SubscriptionTier) : null;
}

export async function subscribeToCreator(
  arg1: string,
  arg2: string | SubscriptionTier,
  arg3?: SubscriptionTier,
): Promise<Subscription | null> {
  let subId = '';
  let creatorId = '';
  let tier: SubscriptionTier = 'silver';

  if (arg3 !== undefined) {
    subId = arg1;
    creatorId = arg2 as string;
    tier = arg3;
  } else {
    creatorId = arg1;
    tier = arg2 as SubscriptionTier;
    const { data: authData } = await supabase.auth.getUser();
    subId = authData?.user?.id ?? '';
  }

  const { data } = await supabase
    .from('subscriptions')
    .upsert(
      {
        subscriber_id: subId,
        creator_id: creatorId,
        tier,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'subscriber_id,creator_id' },
    )
    .select()
    .maybeSingle();
  return data as Subscription | null;
}

export async function sendTip(
  arg1: string,
  arg2: string | number,
  arg3: number | string,
  arg4?: string,
): Promise<Tip | null> {
  let senderId = '';
  let creatorId = '';
  let amount = 5;
  let message = '';

  if (arg4 !== undefined) {
    senderId = arg1;
    creatorId = arg2 as string;
    amount = arg3 as number;
    message = arg4;
  } else {
    creatorId = arg1;
    amount = arg2 as number;
    message = arg3 as string;
    const { data: authData } = await supabase.auth.getUser();
    senderId = authData?.user?.id ?? '';
  }

  const { data, error } = await supabase
    .from('tips')
    .insert({
      sender_id: senderId,
      creator_id: creatorId,
      amount,
      message,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  // Increment creator total tips in profile
  const { data: prof } = await supabase.from('profiles').select('total_tips_received').eq('id', creatorId).maybeSingle();
  if (prof) {
    await supabase.from('profiles').update({ total_tips_received: (prof.total_tips_received || 0) + amount }).eq('id', creatorId);
  }

  return data as Tip;
}

export async function fetchTipsForCreator(creatorId: string): Promise<Tip[]> {
  const { data } = await supabase
    .from('tips')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Tip[];
}

/* ------------------------------------------------------------------ */
/* 3. Live Streaming & Audio Spaces                                   */
/* ------------------------------------------------------------------ */

export async function fetchLiveStreams(): Promise<LiveStream[]> {
  const { data } = await supabase
    .from('live_streams')
    .select('*, creator:profiles!live_streams_creator_id_fkey(*)')
    .eq('status', 'live')
    .order('created_at', { ascending: false });
  return (data ?? []) as LiveStream[];
}

export async function createLiveStream(
  creatorId: string,
  title: string,
  streamUrl = 'https://assets.mixkit.co/videos/preview/mixkit-vertical-view-of-a-neon-sign-in-the-rain-41525-large.mp4',
): Promise<LiveStream | null> {
  const { data } = await supabase
    .from('live_streams')
    .insert({
      creator_id: creatorId,
      title,
      stream_url: streamUrl,
      status: 'live',
      viewer_count: 1,
      created_at: new Date().toISOString(),
    })
    .select('*, creator:profiles!live_streams_creator_id_fkey(*)')
    .maybeSingle();
  return data as LiveStream | null;
}

export async function endLiveStream(streamId: string): Promise<void> {
  await supabase.from('live_streams').update({ status: 'ended' }).eq('id', streamId);
}

export async function fetchLiveMessages(streamId: string): Promise<LiveMessage[]> {
  const { data } = await supabase
    .from('live_messages')
    .select('*, author:profiles!live_messages_user_id_fkey(*)')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: true });
  return (data ?? []) as LiveMessage[];
}

export const fetchActiveLiveStreams = fetchLiveStreams;

export async function sendLiveMessage(
  streamId: string,
  arg2: string,
  arg3?: string,
  isPinned = false,
): Promise<LiveMessage | null> {
  let userId = '';
  let body = '';

  if (arg3 !== undefined) {
    userId = arg2;
    body = arg3;
  } else {
    body = arg2;
    const { data: authData } = await supabase.auth.getUser();
    userId = authData?.user?.id ?? '';
  }

  const { data } = await supabase
    .from('live_messages')
    .insert({
      stream_id: streamId,
      user_id: userId,
      body,
      is_pinned: isPinned,
      created_at: new Date().toISOString(),
    })
    .select('*, author:profiles!live_messages_user_id_fkey(*)')
    .maybeSingle();
  return data as LiveMessage | null;
}

export async function fetchAudioSpaces(): Promise<AudioSpace[]> {
  const { data } = await supabase
    .from('audio_spaces')
    .select('*, host:profiles!audio_spaces_host_id_fkey(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  // Hydrate speakers
  return ((data ?? []) as AudioSpace[]).map((sp) => ({
    ...sp,
    speakers: [sp.host],
    hand_raises: [],
  }));
}

export const fetchActiveAudioSpaces = fetchAudioSpaces;

export async function toggleAudioSpaceHand(spaceId: string, raised: boolean): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return;
  const { data: sp } = await supabase.from('audio_spaces').select('raised_hands').eq('id', spaceId).maybeSingle();
  const currentHands: string[] = sp?.raised_hands ?? [];
  const nextHands = raised ? Array.from(new Set([...currentHands, userId])) : currentHands.filter((id) => id !== userId);
  await supabase.from('audio_spaces').update({ raised_hands: nextHands }).eq('id', spaceId);
}

export async function updateAudioSpaceStage(spaceId: string, speakerIds: string[]): Promise<void> {
  await supabase.from('audio_spaces').update({ speaker_ids: speakerIds, speakers_count: speakerIds.length }).eq('id', spaceId);
}

export async function createAudioSpace(
  hostId: string,
  title: string,
  topic = 'General Discussion',
): Promise<AudioSpace | null> {
  const { data } = await supabase
    .from('audio_spaces')
    .insert({
      host_id: hostId,
      title,
      topic,
      status: 'active',
      listener_count: 1,
      created_at: new Date().toISOString(),
    })
    .select('*, host:profiles!audio_spaces_host_id_fkey(*)')
    .maybeSingle();

  if (!data) return null;
  return {
    ...data,
    speakers: [data.host],
    hand_raises: [],
  } as AudioSpace;
}

/* ------------------------------------------------------------------ */
/* 4. Account Lists & Custom Filters                                  */
/* ------------------------------------------------------------------ */

export async function fetchAccountLists(userId: string): Promise<Record<AccountListType, Set<string>> & Array<{ user_id: string; target_user_id: string; list_type: string }>> {
  const { data } = await supabase
    .from('account_lists')
    .select('target_user_id, list_type, user_id')
    .eq('user_id', userId);

  const lists: Record<AccountListType, Set<string>> = {
    close_friends: new Set(),
    favorites: new Set(),
    muted: new Set(),
  };

  const rawArray = data || [];
  for (const item of rawArray) {
    if (lists[item.list_type as AccountListType]) {
      lists[item.list_type as AccountListType].add(item.target_user_id);
    }
  }

  // Combine object and array behavior
  Object.assign(lists, rawArray);
  return lists as any;
}

export async function fetchAccountListMembers(userId: string, listType: AccountListType): Promise<string[]> {
  const lists = await fetchAccountLists(userId);
  return Array.from(lists[listType] || []);
}

export async function toggleAccountList(
  userId: string,
  targetUserId: string,
  listType: AccountListType,
  add: boolean,
): Promise<void> {
  if (add) {
    await supabase.from('account_lists').upsert(
      {
        user_id: userId,
        target_user_id: targetUserId,
        list_type: listType,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,target_user_id,list_type' },
    );
  } else {
    await supabase
      .from('account_lists')
      .delete()
      .eq('user_id', userId)
      .eq('target_user_id', targetUserId)
      .eq('list_type', listType);
  }
}

export const toggleAccountListMember = toggleAccountList;

/* ------------------------------------------------------------------ */
/* 5. Server-Side Gemini AI Integration Client Helpers                */
/* ------------------------------------------------------------------ */

export async function moderateContentSafety(text: string): Promise<{
  safe: boolean;
  isSafe: boolean;
  flaggedCategories: string[];
  warningMessage?: string;
  reason?: string;
}> {
  try {
    const res = await fetch('/api/ai/content-safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return {
      safe: data.safe ?? true,
      isSafe: data.safe ?? true,
      flaggedCategories: data.flaggedCategories ?? [],
      warningMessage: data.warningMessage,
      reason: data.warningMessage,
    };
  } catch {
    return { safe: true, isSafe: true, flaggedCategories: [] };
  }
}

export async function translateText(
  text: string,
  targetLang = 'English',
): Promise<{
  original: string;
  translated: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
}> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });
    const data = await res.json();
    const trans = data.translated || text;
    return {
      original: data.original || text,
      translated: trans,
      translatedText: trans,
      detectedLanguage: data.detectedLanguage || 'Auto',
      targetLanguage: data.targetLanguage || targetLang,
    };
  } catch {
    return {
      original: text,
      translated: text,
      translatedText: text,
      detectedLanguage: 'Auto',
      targetLanguage: targetLang,
    };
  }
}

export async function generateAIMedia(
  prompt: string,
  style = 'Cyberpunk Neon',
  aspectRatio = '1:1',
): Promise<{
  mediaUrl: string;
  imageUrl: string;
  suggestedCaption: string;
  caption: string;
  style: string;
  aspectRatio: string;
}> {
  const res = await fetch('/api/ai/generate-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style, aspectRatio }),
  });
  const data = await res.json();
  const url = data.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&q=80';
  const cap = data.suggestedCaption || '';
  return {
    mediaUrl: url,
    imageUrl: url,
    suggestedCaption: cap,
    caption: cap,
    style: data.style || style,
    aspectRatio: data.aspectRatio || aspectRatio,
  };
}
