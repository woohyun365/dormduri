import type {
  RoommateSearchProfileSummary,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';
import type {
  PublicProfileActionCapabilities,
  PublicTargetActionUnavailableReason,
  PublicTargetResultReadContext,
} from '@repo/shared/profile/contract';

export interface RoommateSummaryCardFactViewModel {
  readonly label: string;
  readonly value: string;
}

export interface RoommateSummaryCardViewModel {
  readonly id: string;
  readonly nickname: string;
  readonly intro: string;
  readonly facts: readonly RoommateSummaryCardFactViewModel[];
  readonly scoreLabel: string | null;
  readonly summaryOnly: boolean;
  readonly detailViewable: boolean;
  readonly resultReadLabel: string | null;
  readonly actionStateLabel: string;
  readonly bookmarked: boolean;
  readonly detailEntryToken: string | null;
}

const EMPTY_INTRO_COPY = '아직 자기소개가 없어요.';

export function mapRoommateSearchItemsToCardViewModels(
  items: readonly RoommateSearchSummary[],
): readonly RoommateSummaryCardViewModel[] {
  return items.map(mapRoommateSearchItemToCardViewModel);
}

export function mapRoommateSearchItemToCardViewModel(
  item: RoommateSearchSummary,
): RoommateSummaryCardViewModel {
  const detailViewable = item.exposure.detailViewable && item.exposure.canViewFull;

  return {
    id: item.id,
    nickname: item.profileSummary.nickname,
    intro: normalizeIntro(item.profileSummary.intro),
    facts: buildSummaryFacts(item.profileSummary),
    scoreLabel: buildScoreLabel(item),
    summaryOnly: !detailViewable,
    detailViewable,
    resultReadLabel: item.resultRead.resultReadable
      ? buildResultReadLabel(item.resultRead.context)
      : null,
    actionStateLabel: buildActionStateLabel(item.actions),
    bookmarked: item.bookmark?.bookmarked === true,
    detailEntryToken: normalizeDetailEntryToken(item.detailEntryToken),
  };
}

function normalizeIntro(intro: string): string {
  const trimmed = intro.trim();
  return trimmed.length > 0 ? trimmed : EMPTY_INTRO_COPY;
}

function buildSummaryFacts(
  summary: RoommateSearchProfileSummary,
): readonly RoommateSummaryCardFactViewModel[] {
  return [
    { label: '흡연', value: lifestyleLabel(summary.smokingBehavior) },
    { label: '잠버릇', value: lifestyleLabel(summary.sleepHabit) },
    { label: '관계', value: lifestyleLabel(summary.relationshipStyle) },
  ];
}

function buildScoreLabel(item: RoommateSearchSummary): string | null {
  if (!item.exposure.scoreVisible || typeof item.matchScore !== 'number') {
    return null;
  }
  return `적합도 ${item.matchScore}점`;
}

function buildResultReadLabel(context: PublicTargetResultReadContext): string | null {
  const labels: Record<Exclude<PublicTargetResultReadContext, 'NONE'>, string> = {
    CURRENT_MATCHED_PARTNER: '현재 매칭 결과 읽기',
    PAST_MATCH_HISTORY: '과거 매칭 결과',
    EXISTING_THREAD: '기존 대화 맥락',
  };

  return context === 'NONE' ? null : labels[context];
}

function buildActionStateLabel(actions: PublicProfileActionCapabilities): string {
  if (actions.canRequestMatch) return '매칭 요청 가능';
  if (actions.canStartChat) return '대화 가능';
  if (actions.canBookmark) return '관심 등록 가능';

  const primaryReason = actions.unavailableReasons[0];
  return primaryReason ? actionUnavailableReasonLabel(primaryReason) : '요약 정보만 표시';
}

function actionUnavailableReasonLabel(reason: PublicTargetActionUnavailableReason): string {
  const labels: Record<PublicTargetActionUnavailableReason, string> = {
    VIEWER_NOT_REGISTERED: '시즌 등록 후 요청할 수 있어요',
    VIEWER_PROFILE_INCOMPLETE: '프로필 완성 후 요청할 수 있어요',
    VIEWER_NOT_ASSIGNED: '건물 배정 후 요청할 수 있어요',
    TARGET_NOT_PUBLIC: '상대가 공개 대상이 아니에요',
    DIFFERENT_DORMITORY: '다른 건물이라 요약만 볼 수 있어요',
    VIEWER_ALREADY_MATCHED: '이미 매칭되어 새 요청이 닫혔어요',
    TARGET_ALREADY_MATCHED: '상대가 이미 매칭되어 새 요청이 닫혔어요',
    SEASON_NOT_ACTIONABLE: '시즌 정책상 새 요청 기능이 닫혔어요',
    ROOM_SELECTION_CUTOFF: '호실 선택 마감 이후에는 요청할 수 없어요',
    THREAD_READ_ONLY: '기존 대화 읽기 전용 상태예요',
    TARGET_DELETED_OR_DEIDENTIFIED: '상대 정보가 더 이상 제공되지 않아요',
    SAFETY_OR_VISIBILITY_RESTRICTED: '안전 정책상 요청할 수 없어요',
  };
  return labels[reason];
}

function normalizeDetailEntryToken(token: string | undefined): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function lifestyleLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
    NONE: '없음',
    HAS: '있음',
    CASUAL: '적당한 거리',
    CLOSE: '가까운 관계',
    DISTANT: '각자 생활',
  };
  return labels[value] ?? value;
}
