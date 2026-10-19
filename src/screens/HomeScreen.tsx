import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchPostsForYou, fetchFollowingFeed, deletePost } from '@/lib/api';
import type { PostWithMeta } from '@/lib/types';
import PostCard from '@/components/PostCard';
import StoriesBar from '@/components/StoriesBar';
import { Plus, Sparkles, Users2, Loader2 } from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
  onCompose: () => void;
}

type Tab = 'foryou' | 'following';

export default function HomeScreen({ onOpenProfile, onCompose }: Props) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('foryou');
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        tab === 'foryou'
          ? await fetchPostsForYou(profile.id)
          : await fetchFollowingFeed(profile.id);
      setPosts(data);
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

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Creators</span>
          </div>
          <button
            onClick={onCompose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition"
            aria-label="New post"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex">
          <TabButton
            active={tab === 'foryou'}
            onClick={() => setTab('foryou')}
            icon={<Sparkles className="w-4 h-4" />}
            label="For You"
          />
          <TabButton
            active={tab === 'following'}
            onClick={() => setTab('following')}
            icon={<Users2 className="w-4 h-4" />}
            label="Following"
          />
        </div>
      </header>

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
          posts.map((p) => (
            <PostCard key={p.id} post={p} onOpenProfile={onOpenProfile} onDelete={onDelete} />
          ))
        )}
      </main>
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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition relative ${
        active ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
    >
      {icon}
      {label}
      {active && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full" />
      )}
    </button>
  );
}

function EmptyState({ tab, onCompose }: { tab: Tab; onCompose: () => void }) {
  return (
    <div className="text-center py-20 px-6">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-4">
        {tab === 'foryou' ? (
          <Sparkles className="w-7 h-7 text-pink-400" />
        ) : (
          <Users2 className="w-7 h-7 text-sky-400" />
        )}
      </div>
      <h2 className="font-semibold text-lg mb-1">
        {tab === 'foryou' ? 'No posts yet' : 'Nothing from your follows'}
      </h2>
      <p className="text-sm text-white/50 mb-5 max-w-xs mx-auto">
        {tab === 'foryou'
          ? 'Be the first to share something with the community.'
          : 'Follow some creators from Discover, or share your first post.'}
      </p>
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
