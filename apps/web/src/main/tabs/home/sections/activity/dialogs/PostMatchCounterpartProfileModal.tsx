import { UserRound } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { DetailRow, formatProfileValue } from '../ActivityDetailRows';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

export function PostMatchCounterpartProfileModal({
  activeMatch,
  onClose,
}: {
  activeMatch: NonNullable<HomeDashboardViewModel['matchingSummary']['activeMatch']>;
  onClose: () => void;
}) {
  const summary = activeMatch.counterpartSummary?.profileSummary;
  const intro = summary?.intro.trim() || '아직 소개 문구가 없어요.';

  return (
    <HomeResponsiveSheet
      eyebrow="매칭 상대 프로필"
      title={`${activeMatch.nickname}님`}
      description="현재 확정된 매칭 상대의 시즌 프로필을 확인해요."
      icon={UserRound}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인했어요
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-bold text-emerald-700">소개</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{intro}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="닉네임" value={activeMatch.nickname} />
          <DetailRow label="매칭도" value={`${activeMatch.matchScore}%`} />
          <DetailRow label="흡연" value={formatProfileValue(summary?.smokingBehavior)} />
          <DetailRow label="수면" value={formatProfileValue(summary?.sleepHabit)} />
        </div>
      </div>
    </HomeResponsiveSheet>
  );
}
