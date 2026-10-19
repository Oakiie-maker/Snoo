import type { Profile } from '@/lib/types';
import { avatarGradient, initials } from '@/lib/utils';

interface Props {
  profile: Profile;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-20 h-20 text-xl',
};

export default function Avatar({ profile, size = 'md', ring = false }: Props) {
  const dim = SIZE[size];
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.username}
        className={`${dim} rounded-full object-cover ${ring ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0a0a0f]' : ''}`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br ${avatarGradient(profile.id)} flex items-center justify-center font-semibold text-white shrink-0 ${ring ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-[#0a0a0f]' : ''}`}
    >
      {initials(profile.full_name || profile.username)}
    </div>
  );
}
