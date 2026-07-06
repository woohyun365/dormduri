import { UserRound } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { formatProfileValue } from '../ActivityDetailRows';
import { PublicProfileDetailContent } from '../../../profile-modals/HomeProfileDetailContent';
import { usePublicProfileDetail } from '../../../profile-modals/useHomeProfileDetail';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';

export function PostMatchCounterpartProfileModal({
  activeMatch,
  onClose,
}: {
  activeMatch: NonNullable<HomeDashboardViewModel['matchingSummary']['activeMatch']>;
  onClose: () => void;
}) {
  const summary = activeMatch.counterpartSummary?.profileSummary;
  const profileState = usePublicProfileDetail(activeMatch.counterpartUserId, true);

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
      <PublicProfileDetailContent
        state={profileState}
        fallbackNickname={activeMatch.nickname}
        fallbackRows={[
          { label: '닉네임', value: activeMatch.nickname },
          { label: '매칭도', value: `${activeMatch.matchScore}%` },
          { label: '흡연', value: formatProfileValue(summary?.smokingBehavior) },
          { label: '수면', value: formatProfileValue(summary?.sleepHabit) },
        ]}
      />
    </HomeResponsiveSheet>
  );
}
