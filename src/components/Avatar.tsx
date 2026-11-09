import type { Profile } from '@/lib/types';
import { avatarGradient, initials } from '@/lib/utils';

interface Props {
  profile: Profile;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  showStatus?: boolean;
  isOnline?: boolean;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
};

const DOT_SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-2 h-2 -bottom-0.5 -right-0.5 border',
  sm: 'w-2.5 h-2.5 bottom-0 right-0 border-[1.5px]',
  md: 'w-3 h-3 bottom-0.5 right-0.5 border-2',
  lg: 'w-4 h-4 bottom-1 right-1 border-2',
  xl: 'w-5 h-5 bottom-1.5 right-1.5 border-[2.5px]',
};

export default function Avatar({
  profile,
  size = 'md',
  ring = false,
  showStatus = false,
  isOnline,
}: Props) {
  const dim = SIZE[size];
  const dotDim = DOT_SIZE[size];

  // If `isOnline` is explicitly passed, use it; otherwise check profile.is_online
  const activeOnline = isOnline !== undefined ? isOnline : Boolean(profile.is_online);
  const canShowDot = showStatus && profile.show_online_status !== false;

  return (
    <div className="relative inline-block shrink-0">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.username}
          className={`${dim} rounded-full object-cover ${
            ring ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0a0a0f]' : ''
          }`}
        />
      ) : (
        <div
          className={`${dim} rounded-full bg-gradient-to-br ${avatarGradient(
            profile.id,
          )} flex items-center justify-center font-semibold text-white shrink-0 ${
            ring ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0a0a0f]' : ''
          }`}
        >
          {initials(profile.full_name || profile.username)}
        </div>
      )}

      {canShowDot && activeOnline && (
        <span
          className={`absolute ${dotDim} rounded-full bg-emerald-400 border-[#0a0a0f] shadow-sm shadow-emerald-500/50`}
          title="Online now"
          aria-label="Online"
        >
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
        </span>
      )}
    </div>
  );
}
