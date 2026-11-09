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
  fetchMutualConnections,
  fetchFollowersList,
  fetchFollowingList,
  fetchMutualsList,
  updatePrivacySettings,
  getUserSubscriptionTier,
  fetchAccountLists,
  toggleAccountListMember,
} from '@/lib/api';
import type {
  FollowRelationshipUser,
  MutualConnectionInfo,
  PostWithMeta,
  Profile,
  SubscriptionTier,
  AccountListType,
} from '@/lib/types';
import { TIER_CONFIG } from '@/lib/types';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/PostCard';
import Modal from '@/components/Modal';
import SocialListModal, { type SocialTab } from '@/components/SocialListModal';
import TipModal from '@/components/TipModal';
import SubscribeModal from '@/components/SubscribeModal';
import { usePresence, formatRelativeActiveTime } from '@/hooks/usePresence';
import {
  ArrowLeft,
  Settings,
  Check,
  UserPlus,
  Loader2,
  Camera,
  Sparkles,
  Users,
  Shield,
  Crown,
  DollarSign,
  Star,
  HeartHandshake,
  VolumeX,
  MoreHorizontal,
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
  const [mutualInfo, setMutualInfo] = useState<MutualConnectionInfo | null>(null);

  // Monetization & Subscription states
  const [showTipModal, setShowTipModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribedTier, setSubscribedTier] = useState<SubscriptionTier | null>(null);

  // Privacy & Custom Lists states
  const [userLists, setUserLists] = useState<Record<AccountListType, boolean>>({
    close_friends: false,
    favorites: false,
    muted: false,
  });
  const [showListMenu, setShowListMenu] = useState(false);

  // Social list modal
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [socialModalTab, setSocialModalTab] = useState<SocialTab>('followers');
  const [socialFollowers, setSocialFollowers] = useState<FollowRelationshipUser[]>([]);
  const [socialFollowing, setSocialFollowing] = useState<FollowRelationshipUser[]>([]);
  const [socialMutuals, setSocialMutuals] = useState<FollowRelationshipUser[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);

  const { isUserOnline } = usePresence();
  const isMe = me?.id === userId;

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const [u, p, f, fg, am, mutual, tier, allLists] = await Promise.all([
      fetchProfile(userId),
      fetchProfilePosts(me.id, userId),
      countFollowers(userId),
      countFollowing(userId),
      isFollowing(me.id, userId),
      !isMe ? fetchMutualConnections(userId, me.id) : Promise.resolve(null),
      !isMe ? getUserSubscriptionTier(me.id, userId) : Promise.resolve(null),
      !isMe ? fetchAccountLists(me.id) : Promise.resolve([]),
    ]);

    setUser(u);
    setPosts(p);
    setFollowers(f);
    setFollowing(fg);
    setAmFollowing(am);
    setMutualInfo(mutual);
    setSubscribedTier(tier);

    if (!isMe && allLists) {
      setUserLists({
        close_friends: allLists.some((item) => item.target_user_id === userId && item.list_type === 'close_friends'),
        favorites: allLists.some((item) => item.target_user_id === userId && item.list_type === 'favorites'),
        muted: allLists.some((item) => item.target_user_id === userId && item.list_type === 'muted'),
      });
    }

    setLoading(false);
  }, [me, userId, isMe]);

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

  const toggleList = async (type: AccountListType) => {
    if (!me) return;
    const nextState = !userLists[type];
    setUserLists((prev) => ({ ...prev, [type]: nextState }));
    await toggleAccountListMember(me.id, userId, type, nextState);
  };

  const openSocialModal = async (tab: SocialTab) => {
    if (!me) return;
    setSocialModalTab(tab);
    setSocialModalOpen(true);
    setLoadingSocial(true);
    const [fers, fing, muts] = await Promise.all([
      fetchFollowersList(userId, me.id),
      fetchFollowingList(userId, me.id),
      fetchMutualsList(userId, me.id),
    ]);
    setSocialFollowers(fers);
    setSocialFollowing(fing);
    setSocialMutuals(muts);
    setLoadingSocial(false);
  };

  const handleToggleFollowInModal = async (targetId: string, currentFollowing: boolean) => {
    if (!me) return;
    const next = !currentFollowing;
    await toggleFollow(me.id, targetId, next);

    const updateList = (list: FollowRelationshipUser[]) =>
      list.map((u) => (u.profile.id === targetId ? { ...u, is_following: next } : u));

    setSocialFollowers(updateList);
    setSocialFollowing(updateList);
    setSocialMutuals(updateList);

    if (targetId === userId) {
      setAmFollowing(next);
      setFollowers((n) => n + (next ? 1 : -1));
    }
  };

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white/40">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <span className="text-sm">Loading profile…</span>
      </div>
    );
  }

  const userOnline = isUserOnline(user.id, user);
  const statusInfo = formatRelativeActiveTime(user.last_seen, userOnline, user.show_online_status);

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
        <div className="px-3 h-14 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/5 transition text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center">
            <span className="font-semibold text-sm truncate text-white">@{user.username}</span>
            {statusInfo.label && (
              <span
                className={`text-[10px] ${
                  userOnline ? 'text-emerald-400 font-semibold' : 'text-white/40'
                }`}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
          {isMe ? (
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-full hover:bg-white/5 transition text-white"
              aria-label="Edit profile & settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowListMenu(!showListMenu)}
                className="p-2 rounded-full hover:bg-white/5 transition text-white/70 hover:text-white"
                aria-label="Account Lists"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {/* Account Lists Dropdown Menu */}
              {showListMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-[#171824] border border-white/10 rounded-2xl shadow-2xl p-2 z-40 animate-fade-in text-xs space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Account Lists
                  </div>
                  <button
                    onClick={() => toggleList('close_friends')}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-white"
                  >
                    <span className="flex items-center gap-2">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                      Close Friends
                    </span>
                    {userLists.close_friends && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <button
                    onClick={() => toggleList('favorites')}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      Favorites
                    </span>
                    {userLists.favorites && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  <button
                    onClick={() => toggleList('muted')}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/5 text-left text-white"
                  >
                    <span className="flex items-center gap-2">
                      <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                      Muted
                    </span>
                    {userLists.muted && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5">
        {/* User Card */}
        <div className="flex items-start gap-4 mb-4">
          <Avatar
            profile={user}
            size="xl"
            ring
            showStatus
            isOnline={userOnline}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate text-white">
                {user.full_name || `@${user.username}`}
              </h1>
              {userOnline && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              )}
              {/* Supporter Tier Badge if subscribed */}
              {subscribedTier && TIER_CONFIG[subscribedTier] && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  <span>{TIER_CONFIG[subscribedTier].badge}</span>
                  <span>{TIER_CONFIG[subscribedTier].name} Member</span>
                </span>
              )}
            </div>

            <p className="text-sm text-white/50 truncate">@{user.username}</p>

            {/* Stats row with clickable followers/following/mutuals modals */}
            <div className="flex gap-5 mt-3 text-white">
              <Stat label="Posts" value={posts.length} />
              <button
                onClick={() => openSocialModal('followers')}
                className="text-left hover:opacity-80 transition"
              >
                <Stat label="Followers" value={followers} />
              </button>
              <button
                onClick={() => openSocialModal('following')}
                className="text-left hover:opacity-80 transition"
              >
                <Stat label="Following" value={following} />
              </button>
            </div>
          </div>
        </div>

        {/* Bio */}
        {user.bio && <p className="text-sm text-white/80 mb-3 whitespace-pre-wrap">{user.bio}</p>}

        {/* Mutual Connection Badge */}
        {!isMe && mutualInfo && mutualInfo.count > 0 && (
          <button
            onClick={() => openSocialModal('mutuals')}
            className="w-full flex items-center gap-2 bg-white/[0.03] border border-white/5 hover:bg-white/5 rounded-xl px-3 py-2 mb-4 text-xs text-white/70 transition text-left"
          >
            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
              {mutualInfo.sampleUsers.map((m) => (
                <Avatar key={m.id} profile={m} size="xs" />
              ))}
            </div>
            <span className="flex-1 truncate">
              Followed by{' '}
              <span className="font-semibold text-white">
                @{mutualInfo.sampleUsers[0]?.username}
              </span>
              {mutualInfo.count > 1
                ? ` and ${mutualInfo.count - 1} other${mutualInfo.count > 2 ? 's' : ''} you know`
                : ''}
            </span>
            <Users className="w-3.5 h-3.5 text-pink-400 shrink-0 ml-1" />
          </button>
        )}

        {/* Action Buttons: Follow, Message, Tip, Subscribe */}
        {!isMe && (
          <div className="space-y-2 mb-6">
            <div className="flex gap-2">
              <button
                onClick={follow}
                disabled={busyFollow}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 font-semibold text-sm py-2.5 rounded-xl transition disabled:opacity-60 ${
                  amFollowing
                    ? 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
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

            {/* Monetization Actions: Tip & Subscribe */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowTipModal(true)}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Tip Creator</span>
              </button>

              <button
                onClick={() => setShowSubscribeModal(true)}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Crown className="w-4 h-4 text-purple-400" />
                <span>{subscribedTier ? 'Manage Tier' : 'Subscribe'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Posts header */}
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

      {/* Followers/Following/Mutuals Modal */}
      <SocialListModal
        open={socialModalOpen}
        onClose={() => setSocialModalOpen(false)}
        initialTab={socialModalTab}
        followers={socialFollowers}
        following={socialFollowing}
        mutuals={socialMutuals}
        loading={loadingSocial}
        onToggleFollow={handleToggleFollowInModal}
        onOpenProfile={onOpenProfile}
        currentUserId={me?.id ?? ''}
      />

      {/* Tip Creator Modal */}
      <TipModal
        creator={user}
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
      />

      {/* Subscribe to Creator Modal */}
      <SubscribeModal
        creator={user}
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
        onSuccess={(tier) => setSubscribedTier(tier)}
      />

      {/* Edit Profile & Privacy Settings Modal */}
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
      <div className="font-bold text-lg tabular-nums text-white">{value}</div>
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
  const [showOnlineStatus, setShowOnlineStatus] = useState(
    profile.show_online_status !== false,
  );
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
        show_online_status: showOnlineStatus,
      });
      await updatePrivacySettings(profile.id, showOnlineStatus);
      onSaved();
    } catch {
      setError('Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Edit Profile & Privacy">
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
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 transition text-white"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-white/60 mb-1.5">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 transition text-white"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-white/60 mb-1.5">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-pink-500/50 resize-none transition text-white"
          />
          <div className="text-[11px] text-white/30 text-right mt-1">{bio.length}/160</div>
        </label>

        {/* Privacy Setting Toggle: Hide Online Status / Last Active Time */}
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-white/5 rounded-lg text-pink-400 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-white">
                  Show Online Status & Activity
                </span>
                <span className="text-xs text-white/40 block mt-0.5">
                  When enabled, other creators can see when you are active now or your relative offline time.
                </span>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={showOnlineStatus}
              onClick={() => setShowOnlineStatus(!showOnlineStatus)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                showOnlineStatus ? 'bg-pink-500' : 'bg-white/15'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  showOnlineStatus ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
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
