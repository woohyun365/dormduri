import { BarChart3, UserRound } from 'lucide-react';
import { HomeResponsiveSheet } from '../../../overlays/HomeResponsiveSheet';
import { PreviousSeasonProfileDetailContent } from '../../../profile-modals/HomeProfileDetailContent';
import { usePreviousSeasonProfileDetail } from '../../../profile-modals/useHomeProfileDetail';
import { DetailMetric, DetailRow, EmptyDetailCard } from '../ActivityDetailRows';
import { resolveViewerActivityTitle } from '../model/activityContent';
import type { HomeDashboardViewModel } from '../../../model/homeDashboardViewModel';
import type { OffSeasonDetailModalKind } from '../model/activityTypes';

export function OffSeasonDetailModal({
  kind,
  viewModel,
  onClose,
}: {
  kind: OffSeasonDetailModalKind | null;
  viewModel: HomeDashboardViewModel;
  onClose: () => void;
}) {
  const lastSeason = viewModel.seasonSummary.lastSeason;
  const previousSeasonProfileState = usePreviousSeasonProfileDetail(
    kind === 'profile' && Boolean(lastSeason),
  );

  if (!kind) return null;

  const title = kind === 'activity' ? '이전 시즌 상세 보기' : '이전 시즌 프로필 확인';
  const description =
    kind === 'activity'
      ? '직전 시즌의 내 요청, 대화, 매칭 결과를 요약해서 보여드려요.'
      : '직전 시즌 참여 상태와 현재 계정 기준 프로필 정보를 함께 확인해요.';

  return (
    <HomeResponsiveSheet
      eyebrow="직전 시즌"
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
        <OffSeasonActivityDetail lastSeason={lastSeason} />
      ) : (
        <OffSeasonProfileDetail
          viewModel={viewModel}
          lastSeason={lastSeason}
          profileState={previousSeasonProfileState}
        />
      )}
    </HomeResponsiveSheet>
  );
}

export function OffSeasonActivityDetail({
  lastSeason,
}: {
  lastSeason: HomeDashboardViewModel['seasonSummary']['lastSeason'];
}) {
  if (!lastSeason) {
    return <EmptyDetailCard message="아직 확인할 수 있는 이전 시즌 활동이 없어요." />;
  }

  const activity = lastSeason.viewerActivity;

  return (
    <div className="space-y-3">
      <DetailRow label="시즌" value={lastSeason.name} />
      <DetailRow label="내 결과" value={resolveViewerActivityTitle(activity.finalResult)} />
      <div className="grid grid-cols-3 gap-2">
        <DetailMetric label="보낸 요청" value={activity.sentRequestCount} />
        <DetailMetric label="받은 요청" value={activity.receivedRequestCount} />
        <DetailMetric label="대화" value={activity.conversationCount} />
      </div>
      {activity.matchedPartnerNickname && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span className="font-extrabold text-green-700">{activity.matchedPartnerNickname}</span>
          님과 매칭이 성사되었어요.
        </div>
      )}
      <p className="text-xs leading-relaxed text-(--knu-text-tertiary)">
        전체 참여 {lastSeason.totalParticipants}명 · 매칭 완료 {lastSeason.totalMatchSuccess}쌍 ·
        운영 건물 {lastSeason.aggregate.operatedDormitoryCount}개
      </p>
    </div>
  );
}

function OffSeasonProfileDetail({
  viewModel,
  lastSeason,
  profileState,
}: {
  viewModel: HomeDashboardViewModel;
  lastSeason: HomeDashboardViewModel['seasonSummary']['lastSeason'];
  profileState: ReturnType<typeof usePreviousSeasonProfileDetail>;
}) {
  const fallbackRows = lastSeason
    ? [
        { label: '참여 시즌', value: lastSeason.name },
        { label: '닉네임', value: viewModel.viewerIdentity.nickname },
        { label: '성별', value: viewModel.viewerIdentity.genderLabel },
        { label: '캠퍼스', value: viewModel.viewerIdentity.campusName },
      ]
    : [];

  if (!lastSeason) {
    return <EmptyDetailCard message="이전 시즌 프로필로 연결할 시즌 참여 기록이 없어요." />;
  }

  return <PreviousSeasonProfileDetailContent state={profileState} fallbackRows={fallbackRows} />;
}
