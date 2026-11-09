import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Profile } from '@/lib/types';
import { updateUserPresence, updatePrivacySettings } from '@/lib/api';

export interface PresenceUserInfo {
  userId: string;
  onlineAt: string;
  lastSeen?: string;
}

export function formatRelativeActiveTime(
  lastSeen?: string | null,
  isOnline?: boolean,
  showOnlineStatus?: boolean,
): { label: string; isOnline: boolean } {
  // If user turned off privacy setting
  if (showOnlineStatus === false) {
    return { label: '', isOnline: false };
  }

  if (isOnline) {
    return { label: 'Active now', isOnline: true };
  }

  if (!lastSeen) {
    return { label: 'Offline', isOnline: false };
  }

  const date = new Date(lastSeen);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 60) return { label: 'Active just now', isOnline: false };
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return { label: `Active ${mins}m ago`, isOnline: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `Active ${hours}h ago`, isOnline: false };
  const days = Math.floor(hours / 24);
  if (days < 7) return { label: `Active ${days}d ago`, isOnline: false };
  const weeks = Math.floor(days / 7);
  return { label: `Active ${weeks}w ago`, isOnline: false };
}

export function usePresence() {
  const { profile, refreshProfile } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceUserInfo>>(new Map());

  const meId = profile?.id;
  const showOnline = profile?.show_online_status !== false;

  useEffect(() => {
    if (!meId) return;

    // Track own presence on channel
    const channel = supabase.channel('online-presence', {
      config: {
        presence: { key: meId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = (channel as any).presenceState?.() || {};
        const activeIds = new Set<string>();
        const pMap = new Map<string, PresenceUserInfo>();

        Object.keys(state).forEach((key) => {
          activeIds.add(key);
          const entries = state[key];
          if (entries && entries[0]) {
            pMap.set(key, {
              userId: key,
              onlineAt: entries[0].online_at || new Date().toISOString(),
              lastSeen: entries[0].last_seen,
            });
          }
        });

        // Ensure current user is in activeIds if presence tracked
        if (showOnline) {
          activeIds.add(meId);
        }
        setOnlineUserIds(activeIds);
        setPresenceMap(pMap);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        setOnlineUserIds((prev) => new Set(prev).add(key));
        if (newPresences?.[0]) {
          setPresenceMap((prev) => {
            const next = new Map(prev);
            next.set(key, {
              userId: key,
              onlineAt: newPresences[0].online_at || new Date().toISOString(),
              lastSeen: newPresences[0].last_seen,
            });
            return next;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: any) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          if (showOnline) {
            await channel.track({
              user_id: meId,
              online_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
            });
            await updateUserPresence(meId, true);
          }
        }
      });

    // Heartbeat every 45s to update last_seen
    const heartbeat = setInterval(() => {
      if (showOnline) {
        updateUserPresence(meId, true);
      }
    }, 45000);

    const handleBeforeUnload = () => {
      if (showOnline) {
        updateUserPresence(meId, false);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      channel.untrack().catch(() => {});
      channel.unsubscribe();
      if (showOnline) {
        updateUserPresence(meId, false).catch(() => {});
      }
    };
  }, [meId, showOnline]);

  const isUserOnline = useCallback(
    (userId: string, targetProfile?: Profile | null): boolean => {
      if (targetProfile && targetProfile.show_online_status === false) {
        return false;
      }
      if (userId === meId) {
        return showOnline;
      }
      return onlineUserIds.has(userId) || Boolean(targetProfile?.is_online);
    },
    [onlineUserIds, meId, showOnline],
  );

  const getStatusText = useCallback(
    (targetProfile?: Profile | null): { label: string; isOnline: boolean } => {
      if (!targetProfile) return { label: '', isOnline: false };
      const online = isUserOnline(targetProfile.id, targetProfile);
      return formatRelativeActiveTime(targetProfile.last_seen, online, targetProfile.show_online_status);
    },
    [isUserOnline],
  );

  const setPrivacy = useCallback(
    async (hideOnline: boolean) => {
      if (!meId) return;
      const willShow = !hideOnline;
      await updatePrivacySettings(meId, willShow);
      await refreshProfile();
    },
    [meId, refreshProfile],
  );

  return {
    onlineUserIds,
    presenceMap,
    isUserOnline,
    getStatusText,
    setPrivacy,
    showOnlineStatus: showOnline,
  };
}
