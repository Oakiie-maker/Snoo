import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  countFollowers,
  countFollowing,
  deletePost,
  fetchProfile,
  fetchProfilePosts,
  isFollowing,
  toggleFollow,
  updateProfile,
  uploadMedia,
} from '@/lib/api';
import type { PostWithMeta, Profile } from '@/lib/types';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/PostCard';
import Modal from '@/components/Modal';
import {
  ArrowLeft,
  Settings,
  Check,
  UserPlus,
  MessageCircle,
  Loader2,
  Camera,
  Sparkles,
} from 'lucide-react';

interface Props {
  userId: string;
  onBack: () => void;
  onOpenProfile: (id: string) => void;
  onMessage: (p: Profile) => void;
}

export default function ProfileScreen({ userId, onBack, onOpenProfile, onMessage }: Props) {
  const { profile: me, refreshProfile } = useAuth();
  const [user, setUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [amFollowing, setAmFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);

  const isMe = me?.id === userId;

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const [u, p, f, fg, am] = await Promise.all([
      fetchProfile(userId),
      fetchProfilePosts(me.id, userId),
      countFollowers(userId),
      countFollowing(userId),
      isFollowing(me.id, userId),
    ]);
    setUser(u);
    setPosts(p);
    setFollowers(f);
    setFollowing(fg);
    setAmFollowing(am);
    setLoading(false);
  }, [me, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const follow = async () => {
    if (!me) return;
    setBusyFollow(true);
    const next = !amFollowing;
    setAmFollowing(next);
    setFollowers((n) => n + (next ? 1 : -1));
    await toggleFollow(me.id, userId, next);
    setBusyFollow(false);
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white/40">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Loading profile…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-3 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/5 transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm truncate">@{user.username}</span>
          {isMe ? (
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-full hover:bg-white/5 transition"
              aria-label="Edit profile"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => onMessage(user)}
              className="p-2 rounded-full hover:bg-white/5 transition"
              aria-label="Message"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5">
        <div className="flex items-start gap-4 mb-5">
          <Avatar profile={user} size="xl" ring />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{user.full_name || `@${user.username}`}</h1>
            <p className="text-sm text-white/50 truncate">@{user.username}</p>
            <div className="flex gap-5 mt-3">
              <Stat label="Posts" value={posts.length} />
              <Stat label="Followers" value={followers} />
              <Stat label="Following" value={following} />
            </div>
          </div>
        </div>

        {user.bio && <p className="text-sm text-white/80 mb-5 whitespace-pre-wrap">{user.bio}</p>}

        {!isMe && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={follow}
              disabled={busyFollow}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-60 ${
                amFollowing
                  ? 'bg-white/5 text-white/70 hover:bg-white/10'
                  : 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/20 hover:brightness-110'
              }`}
            >
              {amFollowing ? (
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
            <button
              onClick={() => onMessage(user)}
              className="px-4 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 text-sm font-medium transition"
            >
              Message
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-pink-400" />
          <h2 className="font-semibold text-sm uppercase tracking-wide text-white/60">
            {isMe ? 'Your posts' : 'Posts'}
          </h2>
          <span className="text-xs text-white/30">{posts.length}</span>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-16 text-white/40 text-sm">
            {isMe ? 'You haven’t posted yet.' : 'No posts yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onOpenProfile={onOpenProfile}
                onDelete={
                  isMe
                    ? async (post) => {
                        if (!confirm('Delete this post?')) return;
                        setPosts((ps) => ps.filter((x) => x.id !== post.id));
                        await deletePost(post.id, post.media_url);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </main>

      {isMe && editing && (
        <EditProfileModal
          profile={user}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
            await refreshProfile();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-bold text-lg tabular-nums">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  );
}

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(profile.username);
  const [fullName, setFullName] = useState(profile.full_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAvatar = async (file: File) => {
    const res = await uploadMedia(profile.id, file);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setAvatarUrl(res.url);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(profile.id, {
        username: username.trim(),
        full_name: fullName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      });
      onSaved();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Edit profile">
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <Avatar profile={{ ...profile, avatar_url: avatarUrl }} size="xl" ring />
          <label className="absolute bottom-0 right-0 bg-pink-500 text-white p-2 rounded-full cursor-pointer shadow-lg hover:brightness-110 transition">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onAvatar(f);
              }}
            />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-white/60 mb-1.5">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-white/60 mb-1.5">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 transition"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-white/60 mb-1.5">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 resize-none transition"
          />
          <div className="text-[11px] text-white/30 text-right mt-1">{bio.length}/160</div>
        </label>
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 mt-3">
          {error}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || username.trim().length < 2}
        className="w-full mt-5 bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold py-3 rounded-xl shadow-lg shadow-pink-500/20 hover:brightness-110 disabled:opacity-60 transition flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Save changes
      </button>
    </Modal>
  );
}
