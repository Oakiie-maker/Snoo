import { supabase } from './supabase';
import type {
  Comment,
  Post,
  PostWithMeta,
  Profile,
  ReactionEmoji,
  Reel,
  ReelComment,
  ReelWithMeta,
  Story,
  StoryGroup,
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
      { id: userId, username, full_name: full, bio, avatar_url: avatarUrl },
      { onConflict: 'id' },
    )
    .select()
    .maybeSingle();
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'username' | 'full_name' | 'bio' | 'avatar_url'>>,
): Promise<void> {
  await supabase.from('profiles').update(patch).eq('id', userId);
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
  return rankPosts(data as unknown as RawPost[], meId, limit);
}

export async function fetchFollowingFeed(meId: string, limit = 20): Promise<PostWithMeta[]> {
  const { data: follows } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', meId);

  const ids = (follows ?? []).map((f) => f.followee_id);
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

  return rankPosts((data ?? []) as unknown as RawPost[], meId, limit);
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
    (p) => p.author_id === ownerId || p.collaborators.some((c) => c.user_id === ownerId),
  );
  return rankPosts(filtered, meId, limit);
}

function rankPosts(rows: RawPost[], meId: string, limit: number): PostWithMeta[] {
  const mapped = rows.map((p) => {
    const counts = { ...EMPTY_COUNTS };
    const my: ReactionEmoji[] = [];
    for (const r of p.reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.user_id === meId) my.push(r.emoji);
    }
    const collabs = p.collaborators.map((c) => c.profiles).filter(Boolean);
    const meta: PostWithMeta = {
      ...p,
      collaborators: collabs,
      reaction_counts: counts,
      my_reactions: my,
      comment_count: p.comments[0]?.count ?? 0,
      share_count: p.shares[0]?.count ?? 0,
    };
    return meta;
  });

  const totalReactions = (m: PostWithMeta) =>
    Object.values(m.reaction_counts).reduce((a, b) => a + b, 0);
  const score = (m: PostWithMeta) => {
    const ageH = (Date.now() - new Date(m.created_at).getTime()) / 3_600_000;
    const engagement = totalReactions(m) * 3 + m.comment_count * 4 + m.share_count * 5;
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
): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ author_id: authorId, caption, media_url: mediaUrl, media_type: mediaType })
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

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  return !!data;
}

export async function toggleFollow(
  followerId: string,
  followeeId: string,
  follow: boolean,
): Promise<void> {
  if (follow) {
    await supabase
      .from('follows')
      .upsert({ follower_id: followerId, followee_id: followeeId }, { onConflict: 'follower_id,followee_id' });
  } else {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);
  }
}

export interface DiscoverList {
  followBack: Profile[];
  suggested: Profile[];
  followingIds: string[];
  followerIds: string[];
}

export async function fetchDiscover(meId: string): Promise<DiscoverList> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('followee_id', meId),
    supabase.from('follows').select('followee_id').eq('follower_id', meId),
  ]);

  const followerIds = (followers.data ?? []).map((f) => f.follower_id);
  const followingIds = (following.data ?? []).map((f) => f.followee_id);

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
    .eq('followee_id', userId);
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
  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, type: isVideo ? 'video' : 'image' };
}

export async function fetchConversations(meId: string) {
  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`sender_id.eq.${meId},recipient_id.eq.${meId}`)
    .order('created_at', { ascending: false });

  type Row = {
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
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

  return (profiles ?? [] as Profile[]).map((p) => {
    const entry = byUser.get((p as Profile).id)!;
    return {
      other: p as Profile,
      last_body: entry.last.body,
      last_at: entry.last.created_at,
      unread: entry.unread,
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

export async function sendMessage(meId: string, otherId: string, body: string): Promise<void> {
  await supabase.from('messages').insert({ sender_id: meId, recipient_id: otherId, body });
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

  // Order: me first, then by most recent story
  const groups: StoryGroup[] = authorIds.map((aid) => {
    const storyRows = authorMap.get(aid)!;
    const author = storyRows[storyRows.length - 1].author;
    const stories: Story[] = storyRows.map(({ author: _author, ...rest }) => rest);
    return { author, stories, viewedIds: stories.filter((s) => viewedSet.has(s.id)).map((s) => s.id) };
  });
  groups.sort((a, b) => {
    if (a.author.id === meId) return -1;
    if (b.author.id === meId) return 1;
    return new Date(b.stories[b.stories.length - 1].created_at).getTime() -
      new Date(a.stories[a.stories.length - 1].created_at).getTime();
  });
  return groups;
}

export async function createStory(
  authorId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  caption: string,
): Promise<Story | null> {
  const { data } = await supabase
    .from('stories')
    .insert({ author_id: authorId, media_url: mediaUrl, media_type: mediaType, caption })
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

export async function fetchStoryViewers(storyId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('story_views')
    .select('user:profiles!story_views_user_id_fkey(*)')
    .eq('story_id', storyId);
  return ((data ?? []) as unknown as { user: Profile }[]).map((r) => r.user);
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
  return rankReels((data ?? []) as unknown as RawReel[], meId, limit);
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
  return rankReels((data ?? []) as unknown as RawReel[], meId, limit);
}

function rankReels(rows: RawReel[], meId: string, limit: number): ReelWithMeta[] {
  const mapped = rows.map((r) => {
    const counts = { ...EMPTY_COUNTS };
    const my: ReactionEmoji[] = [];
    for (const rx of r.reactions) {
      counts[rx.emoji] = (counts[rx.emoji] ?? 0) + 1;
      if (rx.user_id === meId) my.push(rx.emoji);
    }
    const meta: ReelWithMeta = {
      ...r,
      reaction_counts: counts,
      my_reactions: my,
      comment_count: r.comments[0]?.count ?? 0,
      share_count: r.shares[0]?.count ?? 0,
    };
    return meta;
  });
  const total = (m: ReelWithMeta) => Object.values(m.reaction_counts).reduce((a, b) => a + b, 0);
  const score = (m: ReelWithMeta) => {
    const ageH = (Date.now() - new Date(m.created_at).getTime()) / 3_600_000;
    return total(m) * 3 + m.comment_count * 4 + m.share_count * 5 - Math.log2(ageH + 2) * 2;
  };
  return mapped.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

export async function createReel(
  authorId: string,
  videoUrl: string,
  caption: string,
  audioLabel: string | null,
): Promise<Reel | null> {
  const { data } = await supabase
    .from('reels')
    .insert({ author_id: authorId, video_url: videoUrl, caption, audio_label: audioLabel })
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
