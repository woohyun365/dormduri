import { UserRound } from 'lucide-react';
import { HomeResponsiveDialog } from '../../overlays/HomeResponsiveDialog';
import { PublicProfileDetailContent } from '../../profile-modals/HomeProfileDetailContent';
import { usePublicProfileDetail } from '../../profile-modals/useHomeProfileDetail';
import { formatProfileValue } from './model/matchingSummaryContent';
import type { MatchingSummaryActiveMatch } from './HomeMatchingSummary';

export function ActiveMatchProfileTrigger({
  activeMatch,
  isOpen,
  onOpen,
  onClose,
}: {
  activeMatch: MatchingSummaryActiveMatch;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        <UserRound className="size-4" aria-hidden={true} />
        상대 프로필 보기
      </button>
      {isOpen ? <ActiveMatchProfileModal activeMatch={activeMatch} onClose={onClose} /> : null}
    </>
  );
}

function ActiveMatchProfileModal({
  activeMatch,
  onClose,
}: {
  activeMatch: MatchingSummaryActiveMatch;
  onClose: () => void;
}) {
  const summary = activeMatch.counterpartSummary?.profileSummary;
  const profileState = usePublicProfileDetail(activeMatch.counterpartUserId, true);

  return (
    <HomeResponsiveDialog
      label="상대 프로필"
      icon={UserRound}
      eyebrow="매칭 상대 프로필"
      title={`${activeMatch.nickname}님`}
      description="현재 확정된 매칭 상대의 시즌 프로필을 확인해요."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          확인했어요
        </button>
      }
    >
      <div className="space-y-3">
        <PublicProfileDetailContent
          state={profileState}
          fallbackNickname={activeMatch.nickname}
          fallbackRows={[
            { label: '매칭도', value: `${activeMatch.matchScore}%` },
            { label: '확인 맥락', value: '현재 매칭 상대' },
            { label: '흡연', value: formatProfileValue(summary?.smokingBehavior) },
            { label: '수면', value: formatProfileValue(summary?.sleepHabit) },
          ]}
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          상대 프로필은 매칭 결과 확인을 위한 읽기 전용 정보예요. 새 매칭 신청이나 북마크 기능은
          확정 매칭 중에는 열리지 않아요.
        </div>
      </div>
    </HomeResponsiveDialog>
  );
}
