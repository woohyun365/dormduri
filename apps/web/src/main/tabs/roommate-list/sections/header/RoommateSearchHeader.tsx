import { Building2, School, Search } from 'lucide-react';
import type { Ref } from 'react';
import { MainTabHeaderFrame } from '@/main/components/layout/MainTabHeaderFrame';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';

interface RoommateSearchHeaderProps {
  readonly nickname: string;
  readonly gender: 'M' | 'F';
  readonly residenceLabel: string | null;
  readonly campusLabel: string;
  readonly onNavigateProfile?: () => void;
  readonly frameRef?: Ref<HTMLElement>;
}

export function RoommateSearchHeader({
  nickname,
  gender,
  residenceLabel,
  campusLabel,
  onNavigateProfile,
  frameRef,
}: RoommateSearchHeaderProps) {
  const avatarColor = getAvatarColor(nickname);
  return (
    <MainTabHeaderFrame tone="primary" width="home" contentClassName="min-w-0" frameRef={frameRef}>
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/15">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/70">룸메이트 찾기</p>
            <h1 className="mt-0.5 truncate text-2xl font-bold text-white md:text-3xl">
              {nickname}님
            </h1>
          </div>
        </div>
        <button
          type="button"
          aria-label={`${nickname} 프로필 보기`}
          disabled={!onNavigateProfile}
          onClick={onNavigateProfile}
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl font-bold transition hover:scale-105 disabled:cursor-default ${avatarColor.bg} ${avatarColor.text}`}
        >
          {nickname.trim().charAt(0) || '나'}
        </button>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-white/20 px-2.5 py-1">{gender === 'M' ? '남' : '여'}</span>
        <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
          {residenceLabel ? (
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <School className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{residenceLabel ?? campusLabel}</span>
        </span>
      </div>
    </MainTabHeaderFrame>
  );
}
