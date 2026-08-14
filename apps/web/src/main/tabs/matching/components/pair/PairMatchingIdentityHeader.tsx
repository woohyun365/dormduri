'use client';

import { motion } from 'motion/react';
import { Building2, Calendar, School } from 'lucide-react';
import { getAvatarColor } from '@/main/components/avatar/avatarPresentation';
import type { MatchingShellHeroView } from '../../model/matching-shell-presentation';
import type { MatchingViewerHeader } from '../../model/matching-viewer-header';

export function PairMatchingIdentityHeader({
  hero,
  viewer,
  deadlineLabel,
  showSeasonResidence,
  onNavigateProfile,
}: {
  readonly hero: MatchingShellHeroView;
  readonly viewer?: MatchingViewerHeader;
  readonly deadlineLabel: string | null;
  readonly showSeasonResidence: boolean;
  readonly onNavigateProfile?: () => void;
}) {
  const avatarColor = getAvatarColor(viewer?.nickname ?? '매칭');

  return (
    <div data-testid="matching-tab-hero" data-design-source="legacy-pair">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-sm opacity-90">매칭 현황</p>
          <h1 id="matching-tab-heading" tabIndex={-1} className="text-2xl font-bold outline-none">
            {viewer ? `${viewer.nickname}님` : hero.title}
          </h1>
        </div>
        {viewer ? (
          <motion.button
            type="button"
            aria-label={`${viewer.nickname} 프로필 보기`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNavigateProfile}
            disabled={!onNavigateProfile}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${avatarColor.bg} ${avatarColor.text} disabled:cursor-default`}
          >
            {viewer.nickname.trim().charAt(0) || '나'}
          </motion.button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm opacity-90">
          {viewer ? (
            <>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {viewer.gender === 'M' ? '남' : '여'}
              </span>
              {showSeasonResidence && viewer.residenceLabel ? (
                <span className="flex min-w-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{viewer.residenceLabel}</span>
                </span>
              ) : !showSeasonResidence ? (
                <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
                  <School className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{viewer.campusLabel}</span>
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-xs">{hero.statusLabel}</span>
          )}
        </div>
        {deadlineLabel ? (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            <Calendar className="h-3 w-3" aria-hidden />
            <span>{deadlineLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
