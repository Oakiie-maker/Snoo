export type ReactionEmoji = 'heart' | 'fire' | 'laugh' | 'wow' | 'clap';

export const REACTIONS: { key: ReactionEmoji; glyph: string; label: string }[] = [
  { key: 'heart', glyph: '❤️', label: 'Love' },
  { key: 'fire', glyph: '🔥', label: 'Fire' },
  { key: 'laugh', glyph: '😂', label: 'Funny' },
  { key: 'wow', glyph: '😮', label: 'Wow' },
  { key: 'clap', glyph: '👏', label: 'Clap' },
];

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  caption: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
}

export interface PostWithMeta extends Post {
  author: Profile;
  collaborators: Profile[];
  reaction_counts: Record<ReactionEmoji, number>;
  my_reactions: ReactionEmoji[];
  comment_count: number;
  share_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile;
}

export interface Conversation {
  other: Profile;
  last_body: string;
  last_at: string;
  unread: number;
}

export interface Story {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  created_at: string;
}

export interface StoryGroup {
  author: Profile;
  stories: Story[];
  viewedIds: string[];
}

export interface Reel {
  id: string;
  author_id: string;
  video_url: string;
  caption: string;
  audio_label: string | null;
  created_at: string;
}

export interface ReelWithMeta extends Reel {
  author: Profile;
  reaction_counts: Record<ReactionEmoji, number>;
  my_reactions: ReactionEmoji[];
  comment_count: number;
  share_count: number;
}

export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile;
}
