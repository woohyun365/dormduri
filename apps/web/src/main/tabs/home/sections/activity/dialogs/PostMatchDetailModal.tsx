import { BarChart3, UserRound } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { SeasonProfileDetailContent } from '../../../profile-modals/HomeProfileDetailContent';
import { useCurrentSeasonProfileDetail } from '../../../profile-modals/useHomeProfileDetail';
import { OffSeasonActivityDetail } from './OffSeasonDetailModal';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { PostMatchDetailModalKind } from '../model/activityTypes';

export function PostMatchDetailModal({
  kind,
  viewModel,
  onClose,
}: {
  kind: PostMatchDetailModalKind | null;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  if (!kind) return null;

  const title = kind === 'activity' ? '이번 시즌 상세 보기' : '이번 시즌 프로필 확인';
  const description =
    kind === 'activity'
      ? '이번 시즌의 내 요청, 대화, 매칭 결과를 요약해서 보여드려요.'
      : '이번 시즌 참여 상태와 현재 계정 기준 프로필 정보를 함께 확인해요.';

  return (
    <HomeResponsiveSheet
      eyebrow="이번 시즌"
      title={title}
      description={description}
      icon={kind === 'activity' ? BarChart3 : UserRound}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 flex-1 rounded-xl bg-(--knu-primary) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--knu-primary-dark)"
        >
          확인
        </button>
      }
    >
      {kind === 'activity' ? (
        <OffSeasonActivityDetail lastSeason={viewModel.seasonSummary.lastSeason} />
      ) : (
        <PostMatchProfileDetail viewModel={viewModel} />
      )}
    </HomeResponsiveSheet>
  );
}

function PostMatchProfileDetail({ viewModel }: { viewModel: HomeDashboardViewModel }) {
  const profileState = useCurrentSeasonProfileDetail(true);

  return (
    <SeasonProfileDetailContent
      state={profileState}
      fallbackRows={[
        { label: '참여 시즌', value: viewModel.currentSeasonName },
        { label: '닉네임', value: viewModel.viewerIdentity.nickname },
        { label: '성별', value: viewModel.viewerIdentity.genderLabel },
        { label: '캠퍼스', value: viewModel.viewerIdentity.campusName },
        { label: '기숙사', value: viewModel.dormitory?.name ?? '미선택' },
      ]}
    />
  );
}
