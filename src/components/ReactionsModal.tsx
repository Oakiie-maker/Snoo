import { useState } from 'react';
import type { ReactionDetailUser, ReactionEmoji } from '@/lib/types';
import { REACTIONS } from '@/lib/types';
import Avatar from './Avatar';
import Modal from './Modal';
import { usePresence, formatRelativeActiveTime } from '@/hooks/usePresence';
import { UserPlus, Check, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  reactions: ReactionDetailUser[];
  loading?: boolean;
  onToggleFollow: (userId: string, currentFollowing: boolean) => void;
  onOpenProfile?: (id: string) => void;
}

export default function ReactionsModal({
  open,
  onClose,
  reactions,
  loading = false,
  onToggleFollow,
  onOpenProfile,
}: Props) {
  const [selectedEmoji, setSelectedEmoji] = useState<ReactionEmoji | 'all'>('all');
  const { isUserOnline } = usePresence();

  const filtered = selectedEmoji === 'all'
    ? reactions
    : reactions.filter((r) => r.emoji === selectedEmoji);

  return (
    <Modal open={open} onClose={onClose} title="Reactions">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-3 border-b border-white/5 mb-3">
        <button
          onClick={() => setSelectedEmoji('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            selectedEmoji === 'all'
              ? 'bg-white text-[#0a0a0f]'
              : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          All ({reactions.length})
        </button>
        {REACTIONS.map((r) => {
          const count = reactions.filter((rx) => rx.emoji === r.key).length;
          if (count === 0 && selectedEmoji !== r.key) return null;
          const active = selectedEmoji === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setSelectedEmoji(r.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                active
                  ? 'bg-white text-[#0a0a0f]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{r.glyph}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {/* User list */}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading reactions…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">No reactions found for this filter.</p>
        ) : (
          filtered.map((item) => {
            const online = isUserOnline(item.profile.id, item.profile);
            const status = formatRelativeActiveTime(
              item.profile.last_seen,
              online,
              item.profile.show_online_status,
            );
            const reactionGlyph = REACTIONS.find((rx) => rx.key === item.emoji)?.glyph;

            return (
              <div
                key={`${item.profile.id}-${item.emoji}`}
                className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition"
              >
                <button
                  onClick={() => {
                    onClose();
                    onOpenProfile?.(item.profile.id);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="relative">
                    <Avatar
                      profile={item.profile}
                      size="sm"
                      showStatus
                      isOnline={online}
                    />
                    <span className="absolute -bottom-1 -right-1 text-xs bg-[#14141b] rounded-full p-0.5 border border-white/10">
                      {reactionGlyph}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      <span>@{item.profile.username}</span>
                      {online && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {item.profile.full_name || (status.label ? status.label : 'Creator')}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => onToggleFollow(item.profile.id, item.is_following)}
                  className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                    item.is_following
                      ? 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      : 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-md shadow-pink-500/20 hover:brightness-110'
                  }`}
                >
                  {item.is_following ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Follow
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
