import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchDiscover, toggleFollow } from '@/lib/api';
import type { DiscoverList } from '@/lib/api';
import type { Profile } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { UserPlus, Check, RefreshCw, Users2, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onOpenProfile: (id: string) => void;
}

export default function DiscoverScreen({ onOpenProfile }: Props) {
  const { profile } = useAuth();
  const [data, setData] = useState<DiscoverList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const d = await fetchDiscover(profile.id);
    setData(d);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile]);

  const follow = async (other: Profile, follow: boolean) => {
    if (!profile || busyId) return;
    setBusyId(other.id);
    const following = new Set(data?.followingIds ?? []);
    if (follow) following.add(other.id);
    else following.delete(other.id);
    setData((d) => (d ? { ...d, followingIds: Array.from(following) } : d));
    await toggleFollow(profile.id, other.id, follow);
    setBusyId(null);
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Finding creators…</span>
      </div>
    );
  }

  const followedIds = new Set(data.followingIds);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-lg">Discover</h1>
          <button
            onClick={load}
            className="p-2 rounded-full hover:bg-white/5 transition"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-4 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-pink-400" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-white/60">
              Follow back
            </h2>
            <span className="text-xs text-white/30">{data.followBack.length}</span>
          </div>
          {data.followBack.length === 0 ? (
            <p className="text-sm text-white/40 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-5 text-center">
              You're all caught up — you follow everyone who follows you.
            </p>
          ) : (
            <div className="space-y-2">
              {data.followBack.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  following={followedIds.has(p.id)}
                  busy={busyId === p.id}
                  onFollow={() => follow(p, !followedIds.has(p.id))}
                  onOpen={() => onOpenProfile(p.id)}
                  accent
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-sm uppercase tracking-wide text-white/60">
              Suggested creators
            </h2>
          </div>
          {data.suggested.length === 0 ? (
            <p className="text-sm text-white/40 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-5 text-center">
              No more creators to suggest right now.
            </p>
          ) : (
            <div className="space-y-2">
              {data.suggested.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  following={followedIds.has(p.id)}
                  busy={busyId === p.id}
                  onFollow={() => follow(p, !followedIds.has(p.id))}
                  onOpen={() => onOpenProfile(p.id)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-1.5 text-xs text-white/30 pt-2">
          <Users2 className="w-3.3 h-3.5" />
          Follow for follow — support your fellow creators.
        </div>
      </main>
    </div>
  );
}

function Row({
  p,
  following,
  busy,
  onFollow,
  onOpen,
  accent,
}: {
  p: Profile;
  following: boolean;
  busy: boolean;
  onFollow: () => void;
  onOpen: () => void;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-[#14141b] border border-white/5 rounded-2xl px-3 py-2.5">
      <button onClick={onOpen}>
        <Avatar profile={p} size="md" />
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-sm truncate">@{p.username}</div>
        {p.full_name && <div className="text-xs text-white/50 truncate">{p.full_name}</div>}
        {p.bio && <div className="text-xs text-white/40 truncate mt-0.5">{p.bio}</div>}
      </button>
      <button
        onClick={onFollow}
        disabled={busy}
        className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition disabled:opacity-60 ${
          following
            ? 'bg-white/5 text-white/70 hover:bg-white/10'
            : accent
              ? 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/20 hover:brightness-110'
              : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {following ? (
          <>
            <Check className="w-4 h-4" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" />
            Follow
          </>
        )}
      </button>
    </div>
  );
}
