'use client';

import { getAvatarColor } from '@/utils/avatarColor';

interface OverlappedAvatarsProps {
  nicknames: string[];
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { avatar: 'h-6 w-6 text-[10px]', overlap: '-ml-2', ring: 'ring-1' },
  md: { avatar: 'h-8 w-8 text-xs', overlap: '-ml-2.5', ring: 'ring-2' },
  lg: { avatar: 'h-10 w-10 text-sm', overlap: '-ml-3', ring: 'ring-2' },
} as const;

export function OverlappedAvatars({ nicknames, size = 'md' }: OverlappedAvatarsProps) {
  const s = SIZE_MAP[size];

  return (
    <div className="flex items-center">
      {nicknames.map((nickname, i) => {
        const color = getAvatarColor(nickname);
        return (
          <div
            key={`${nickname}-${i}`}
            className={`${s.avatar} ${color.bg} ${color.text} ${s.ring} ring-white rounded-full flex items-center justify-center font-bold flex-shrink-0 ${i > 0 ? s.overlap : ''}`}
            style={{ zIndex: nicknames.length - i }}
          >
            {nickname.charAt(0)}
          </div>
        );
      })}
    </div>
  );
}
