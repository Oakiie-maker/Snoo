import { useState, useMemo } from 'react';
import type { FollowRelationshipUser } from '@/lib/types';
import Avatar from './Avatar';
import Modal from './Modal';
import { usePresence, formatRelativeActiveTime } from '@/hooks/usePresence';
import { Search, UserPlus, Check, Users, Loader2 } from 'lucide-react';

export type SocialTab = 'followers' | 'following' | 'mutuals';

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: SocialTab;
  followers: FollowRelationshipUser[];
  following: FollowRelationshipUser[];
  mutuals: FollowRelationshipUser[];
  loading?: boolean;
  onToggleFollow: (userId: string, currentFollowing: boolean) => Promise<void>;
  onOpenProfile?: (userId: string) => void;
  currentUserId: string;
}

export default function SocialListModal({
  open,
  onClose,
  initialTab = 'followers',
  followers,
  following,
  mutuals,
  loading = false,
  onToggleFollow,
  onOpenProfile,
  currentUserId,
}: Props) {
  const [activeTab, setActiveTab] = useState<SocialTab>(initialTab);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { isUserOnline } = usePresence();

  const currentList = useMemo(() => {
    switch (activeTab) {
      case 'followers':
        return followers;
      case 'following':
        return following;
      case 'mutuals':
        return mutuals;
    }
  }, [activeTab, followers, following, mutuals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return currentList;
    const q = search.trim().toLowerCase();
    return currentList.filter(
      (u) =>
        u.profile.username.toLowerCase().includes(q) ||
        (u.profile.full_name && u.profile.full_name.toLowerCase().includes(q)),
    );
  }, [currentList, search]);

  const handleAction = async (targetId: string, isCurrentlyFollowing: boolean) => {
    if (busyId) return;
    setBusyId(targetId);
    try {
      await onToggleFollow(targetId, isCurrentlyFollowing);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Connections">
      {/* Tab Switcher */}
      <div className="flex border-b border-white/10 mb-3">
        <TabButton
          active={activeTab === 'followers'}
          onClick={() => setActiveTab('followers')}
          label="Followers"
          count={followers.length}
        />
        <TabButton
          active={activeTab === 'following'}
          onClick={() => setActiveTab('following')}
          label="Following"
          count={following.length}
        />
        <TabButton
          active={activeTab === 'mutuals'}
          onClick={() => setActiveTab('mutuals')}
          label="Mutuals"
          count={mutuals.length}
        />
      </div>

      {/* Search Filter */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name or username…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-pink-500/50 transition"
        />
      </div>

      {/* List */}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading creators…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-white/40 text-sm">
            {search ? 'No creators match your search.' : `No ${activeTab} to show yet.`}
          </div>
        ) : (
          filtered.map((item) => {
            const isMe = item.profile.id === currentUserId;
            const online = isUserOnline(item.profile.id, item.profile);
            const status = formatRelativeActiveTime(
              item.profile.last_seen,
              online,
              item.profile.show_online_status,
            );
            const isBusy = busyId === item.profile.id;

            return (
              <div
                key={item.profile.id}
                className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition"
              >
                <button
                  onClick={() => {
                    onClose();
                    onOpenProfile?.(item.profile.id);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <Avatar
                    profile={item.profile}
                    size="md"
                    showStatus
                    isOnline={online}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">
                        @{item.profile.username}
                      </span>
                      {item.is_mutual && (
                        <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded-full font-medium">
                          Mutual
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate flex items-center gap-1.5">
                      {item.profile.full_name && <span>{item.profile.full_name} · </span>}
                      <span className={online ? 'text-emerald-400 font-medium' : ''}>
                        {status.label || 'Offline'}
                      </span>
                    </div>
                  </div>
                </button>

                {!isMe && (
                  <button
                    onClick={() => handleAction(item.profile.id, item.is_following)}
                    disabled={isBusy}
                    className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition disabled:opacity-50 ${
                      item.is_following
                        ? 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                        : item.is_follower
                          ? 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-md shadow-pink-500/20 hover:brightness-110'
                          : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : item.is_following ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Following
                      </>
                    ) : item.is_follower ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Follow Back
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Follow
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 pb-2.5 text-xs font-semibold transition relative text-center ${
        active ? 'text-white' : 'text-white/40 hover:text-white/70'
      }`}
    >
      <span>
        {label} <span className="tabular-nums opacity-60">({count})</span>
      </span>
      {active && (
        <span className="absolute bottom-0 inset-x-4 h-0.5 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full" />
      )}
    </button>
  );
}
