import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchPostsForYou,
  fetchFollowingFeed,
  deletePost,
  fetchActiveAds,
  fetchActiveLiveStreams,
  fetchActiveAudioSpaces,
  fetchAccountListMembers,
} from '@/lib/api';
import type { PostWithMeta, Ad, LiveStream, AudioSpace } from '@/lib/types';
import PostCard from '@/components/PostCard';
import SponsoredCard from '@/components/SponsoredCard';
import StoriesBar from '@/components/StoriesBar';
import LiveStreamModal from '@/components/LiveStreamModal';
import AudioSpaceModal from '@/components/AudioSpaceModal';
import {
  Plus,
  Sparkles,
  Users2,
  Loader2,
  Radio,
  Volume2,
  Star,
  HeartHandshake,
  Megaphone,
} from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
  onCompose: () => void;
  onOpenAdManager?: () => void;
}

type Tab = 'foryou' | 'following' | 'close_friends' | 'favorites';

export default function HomeScreen({ onOpenProfile, onCompose, onOpenAdManager }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('foryou');
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Streams & Audio Spaces
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [audioSpaces, setAudioSpaces] = useState<AudioSpace[]>([]);
  const [activeLiveStream, setActiveLiveStream] = useState<LiveStream | null>(null);
  const [activeAudioSpace, setActiveAudioSpace] = useState<AudioSpace | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch ads, streams, and spaces concurrently
      const [fetchedAds, fetchedStreams, fetchedSpaces] = await Promise.all([
        fetchActiveAds().catch(() => []),
        fetchActiveLiveStreams().catch(() => []),
        fetchActiveAudioSpaces().catch(() => []),
      ]);
      setAds(fetchedAds);
      setLiveStreams(fetchedStreams);
      setAudioSpaces(fetchedSpaces);

      // 2. Fetch posts based on tab
      let rawPosts: PostWithMeta[] = [];
      if (tab === 'foryou') {
        rawPosts = await fetchPostsForYou(profile.id);
      } else if (tab === 'following') {
        rawPosts = await fetchFollowingFeed(profile.id);
      } else if (tab === 'close_friends' || tab === 'favorites') {
        const memberIds = await fetchAccountListMembers(profile.id, tab);
        const allPosts = await fetchPostsForYou(profile.id);
        rawPosts = allPosts.filter((p) => memberIds.includes(p.author_id));
      }
      setPosts(rawPosts);
    } catch {
      setError('Could not load posts. Pull to try again.');
    } finally {
      setLoading(false);
    }
  }, [profile, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (post: PostWithMeta) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    await deletePost(post.id, post.media_url);
  };

  // Build combined feed with SponsoredCards injected every 5 to 7 posts
  const renderedFeedItems: React.ReactNode[] = [];
  const adInjectionInterval = 5; // Injects every 5-7 items as specified
  let adIndex = 0;

  posts.forEach((post, index) => {
    renderedFeedItems.push(
      <PostCard
        key={`post-${post.id}`}
        post={post}
        onOpenProfile={onOpenProfile}
        onDelete={onDelete}
      />
    );

    // Inject sponsored card every 5 items if ads are available
    if ((index + 1) % adInjectionInterval === 0 && ads.length > 0) {
      const ad = ads[adIndex % ads.length];
      adIndex++;
      renderedFeedItems.push(
        <SponsoredCard
          key={`ad-${ad.id}-${index}`}
          ad={ad}
          onOpenProfile={onOpenProfile}
        />
      );
    }
  });

  return (
    <div className="min-h-screen pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Snoo</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAdManager && (
              <button
                onClick={onOpenAdManager}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Ad Manager & Retailer Dashboard"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ad Manager</span>
              </button>
            )}

            <button
              onClick={onCompose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition text-white"
              aria-label="New post"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feed Custom Lists Tabs */}
        <div className="flex border-t border-white/5 overflow-x-auto no-scrollbar">
          <TabButton
            active={tab === 'foryou'}
            onClick={() => setTab('foryou')}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="For You"
          />
          <TabButton
            active={tab === 'following'}
            onClick={() => setTab('following')}
            icon={<Users2 className="w-3.5 h-3.5" />}
            label="Following"
          />
          <TabButton
            active={tab === 'close_friends'}
            onClick={() => setTab('close_friends')}
            icon={<HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />}
            label="Close Friends"
          />
          <TabButton
            active={tab === 'favorites'}
            onClick={() => setTab('favorites')}
            icon={<Star className="w-3.5 h-3.5 text-amber-400" />}
            label="Favorites"
          />
        </div>
      </header>

      {/* Live Broadcast & Audio Spaces Active Ticker */}
      {(liveStreams.length > 0 || audioSpaces.length > 0) && (
        <div className="max-w-xl mx-auto px-3 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {liveStreams.map((stream) => (
              <button
                key={stream.id}
                onClick={() => setActiveLiveStream(stream)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-red-600/20 to-pink-600/20 border border-red-500/40 text-xs text-white shrink-0 hover:brightness-125 transition-all shadow-md shadow-red-500/10"
              >
                <span className="flex items-center gap-1 font-bold text-red-400 uppercase text-[10px] tracking-wider">
                  <Radio className="w-3 h-3 animate-pulse" /> Live
                </span>
                <span className="font-semibold truncate max-w-[150px]">{stream.title}</span>
                <span className="text-[10px] text-white/50">{stream.viewer_count} watching</span>
              </button>
            ))}

            {audioSpaces.map((space) => (
              <button
                key={space.id}
                onClick={() => setActiveAudioSpace(space)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/40 text-xs text-white shrink-0 hover:brightness-125 transition-all shadow-md shadow-purple-500/10"
              >
                <span className="flex items-center gap-1 font-bold text-purple-400 uppercase text-[10px] tracking-wider">
                  <Volume2 className="w-3 h-3" /> Space
                </span>
                <span className="font-semibold truncate max-w-[150px]">{space.title}</span>
                <span className="text-[10px] text-purple-300">
                  {space.speakers_count + space.listeners_count} in room
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-xl mx-auto px-3 py-4 space-y-4">
        <StoriesBar onOpenProfile={onOpenProfile} />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <span className="text-sm">Loading your feed…</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-white/50">
            <p className="mb-3">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm transition"
            >
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState tab={tab} onCompose={onCompose} />
        ) : (
          renderedFeedItems
        )}
      </main>

      {/* Live Stream Fullscreen Modal */}
      {activeLiveStream && profile && (
        <LiveStreamModal
          stream={activeLiveStream}
          currentUser={profile}
          isOpen={true}
          onClose={() => setActiveLiveStream(null)}
        />
      )}

      {/* Audio Space Drawer Modal */}
      {activeAudioSpace && profile && (
        <AudioSpaceModal
          space={activeAudioSpace}
          currentUser={profile}
          isOpen={true}
          onClose={() => setActiveAudioSpace(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition relative shrink-0 ${
        active ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {icon}
      <span>{label}</span>
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full" />
      )}
    </button>
  );
}

function EmptyState({ tab, onCompose }: { tab: Tab; onCompose: () => void }) {
  let title = 'No posts yet';
  let desc = 'Be the first to share something with the community.';
  if (tab === 'following') {
    title = 'Nothing from your follows';
    desc = 'Follow some creators from Discover, or share your first post.';
  } else if (tab === 'close_friends') {
    title = 'No Close Friends posts';
    desc = 'Add creators to your Close Friends list on their profiles to see their posts here.';
  } else if (tab === 'favorites') {
    title = 'No Favorites posts';
    desc = 'Add creators to your Favorites list on their profiles to see their posts here.';
  }

  return (
    <div className="text-center py-20 px-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
        {tab === 'foryou' ? (
          <Sparkles className="w-7 h-7 text-pink-400" />
        ) : tab === 'close_friends' ? (
          <HeartHandshake className="w-7 h-7 text-emerald-400" />
        ) : tab === 'favorites' ? (
          <Star className="w-7 h-7 text-amber-400" />
        ) : (
          <Users2 className="w-7 h-7 text-sky-400" />
        )}
      </div>
      <h2 className="font-semibold text-lg mb-1 text-white">{title}</h2>
      <p className="text-sm text-white/50 mb-5 max-w-xs mx-auto">{desc}</p>
      <button
        onClick={onCompose}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg shadow-pink-500/20 hover:brightness-110 transition"
      >
        <Plus className="w-4 h-4" />
        Create a post
      </button>
    </div>
  );
}
