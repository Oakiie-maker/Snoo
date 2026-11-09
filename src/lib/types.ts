export type ReactionEmoji = 'heart' | 'fire' | 'laugh' | 'wow' | 'clap';

export const REACTIONS: { key: ReactionEmoji; glyph: string; label: string }[] = [
  { key: 'heart', glyph: '❤️', label: 'Love' },
  { key: 'fire', glyph: '🔥', label: 'Fire' },
  { key: 'laugh', glyph: '😂', label: 'Funny' },
  { key: 'wow', glyph: '😮', label: 'Wow' },
  { key: 'clap', glyph: '👏', label: 'Clap' },
];

export type SubscriptionTier = 'bronze' | 'silver' | 'gold';

export const TIER_CONFIG: Record<
  SubscriptionTier,
  { name: string; price: number; badgeColor: string; icon: string; benefits: string[] }
> = {
  bronze: {
    name: 'Bronze Supporter',
    price: 4.99,
    badgeColor: 'from-amber-600 to-amber-700 text-amber-100 border-amber-500/40',
    icon: '🥉',
    benefits: ['Supporter badge in comments', 'Exclusive creator posts', 'Subscriber-only stories'],
  },
  silver: {
    name: 'Silver VIP',
    price: 9.99,
    badgeColor: 'from-slate-300 to-slate-400 text-slate-900 border-slate-300/60',
    icon: '🥈',
    benefits: ['All Bronze perks', 'Priority DM responses', 'Special Audio Spaces speaker access'],
  },
  gold: {
    name: 'Gold Elite',
    price: 24.99,
    badgeColor: 'from-amber-300 via-yellow-400 to-amber-500 text-amber-950 border-amber-300/80',
    icon: '👑',
    benefits: ['All Silver perks', 'Monthly 1-on-1 AMA call', 'Co-host live stream invites', 'Lifetime supporter flair'],
  },
};

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen?: string | null;
  is_online?: boolean;
  show_online_status?: boolean;
  is_verified?: boolean;
  subscriber_tier?: SubscriptionTier | null;
  is_subscribed_to_me?: boolean;
  am_subscribed_to_them?: boolean;
  my_subscription_tier?: SubscriptionTier | null;
  total_tips_received?: number;
}

export interface Post {
  id: string;
  author_id: string;
  caption: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  is_subscribers_only?: boolean;
  paid_partnership_brand?: string | null;
}

export interface PostInsights {
  reach: number;
  impressions: number;
  unique_viewers: number;
  avg_view_duration_sec: number;
  total_engagement_rate: number;
  saves: number;
  shares: number;
  top_demographics: { label: string; percent: number }[];
  trend: { day: string; views: number; engagements: number }[];
}

export interface PostWithMeta extends Post {
  author: Profile;
  collaborators: Profile[];
  reaction_counts: Record<ReactionEmoji, number>;
  my_reactions: ReactionEmoji[];
  comment_count: number;
  share_count: number;
  views_count: number;
  save_count: number;
  is_saved: boolean;
  engagement_rate: number;
  insights?: PostInsights;
  is_unlocked?: boolean;
  translated_caption?: string;
  is_translated?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile;
  supporter_tier?: SubscriptionTier;
  translated_body?: string;
  is_translated?: boolean;
}

export interface Conversation {
  other: Profile;
  last_body: string;
  last_at: string;
  unread: number;
  is_encrypted?: boolean;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  is_encrypted?: boolean;
}

export interface Story {
  id: string;
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string;
  created_at: string;
  is_subscribers_only?: boolean;
}

export interface StoryViewerUser {
  profile: Profile;
  viewed_at: string;
  is_following: boolean;
  engagement_score: number;
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
  paid_partnership_brand?: string | null;
}

export interface ReelWithMeta extends Reel {
  author: Profile;
  reaction_counts: Record<ReactionEmoji, number>;
  my_reactions: ReactionEmoji[];
  comment_count: number;
  share_count: number;
  views_count: number;
  save_count: number;
  is_saved: boolean;
  engagement_rate: number;
  is_unlocked?: boolean;
}

export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile;
  supporter_tier?: SubscriptionTier;
}

export interface ReactionDetailUser {
  profile: Profile;
  emoji: ReactionEmoji;
  created_at: string;
  is_following: boolean;
}

export interface FollowRelationshipUser {
  profile: Profile;
  is_following: boolean;
  is_mutual: boolean;
  is_follower: boolean;
}

export interface MutualConnectionInfo {
  count: number;
  sampleUsers: Profile[];
}

/* ------------------------------------------------------------------ */
/* Ad Manager & Sponsored Content Types                               */
/* ------------------------------------------------------------------ */

export interface Ad {
  id: string;
  advertiser_id: string;
  advertiser?: Profile;
  title: string;
  caption: string;
  media_url: string;
  media_type: 'image' | 'video';
  target_link: string;
  cta_text: string;
  budget: number;
  status: 'active' | 'paused';
  target_demographics: string;
  impressions: number;
  clicks: number;
  created_at: string;
}

export interface AdAnalyticsDay {
  day: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
}

/* ------------------------------------------------------------------ */
/* Subscriptions & Fan Tipping Types                                  */
/* ------------------------------------------------------------------ */

export interface Subscription {
  id: string;
  subscriber_id: string;
  creator_id: string;
  tier: SubscriptionTier;
  created_at: string;
  creator?: Profile;
  subscriber?: Profile;
}

export interface Tip {
  id: string;
  sender_id: string;
  creator_id: string;
  amount: number;
  message: string;
  created_at: string;
  sender?: Profile;
}

/* ------------------------------------------------------------------ */
/* Live Streams & Audio Spaces Types                                  */
/* ------------------------------------------------------------------ */

export interface LiveStream {
  id: string;
  creator_id: string;
  creator: Profile;
  title: string;
  stream_url: string;
  status: 'live' | 'ended';
  viewer_count: number;
  created_at: string;
}

export interface LiveMessage {
  id: string;
  stream_id: string;
  user_id: string;
  author: Profile;
  body: string;
  is_pinned: boolean;
  created_at: string;
}

export interface AudioSpace {
  id: string;
  host_id: string;
  host: Profile;
  title: string;
  topic: string;
  status: 'active' | 'ended';
  listener_count: number;
  speakers: Profile[];
  hand_raises: string[];
  is_speaking?: boolean;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Account Lists & Feed Filters                                       */
/* ------------------------------------------------------------------ */

export type AccountListType = 'close_friends' | 'favorites' | 'muted';

export interface AccountListItem {
  id: string;
  user_id: string;
  target_user_id: string;
  list_type: AccountListType;
  profile?: Profile;
}
