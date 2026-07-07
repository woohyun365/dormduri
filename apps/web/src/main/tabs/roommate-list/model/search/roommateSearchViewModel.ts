import type { BookmarkListItem } from '@repo/shared/social-safety/bookmark';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import type {
  PublicProfileActionCapabilities,
  PublicTargetActionUnavailableReason,
  PublicTargetResultReadContext,
} from '@repo/shared/profile/contract';

export interface RoommateSummaryCardFactViewModel {
  readonly label: string;
  readonly value: string;
}

export interface RoommateBookmarkActionViewModel {
  readonly visible: boolean;
  readonly bookmarked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly accessibilityLabel: string;
}

export interface RoommateChatActionViewModel {
  readonly visible: boolean;
  readonly label: string;
  readonly accessibilityLabel: string;
}

export type RoommateSummaryCardStatusBadgeTone = 'green' | 'amber' | 'slate';

export interface RoommateSummaryCardStatusBadgeViewModel {
  readonly label: string;
  readonly tone: RoommateSummaryCardStatusBadgeTone;
}

export interface RoommateSummaryCardViewModel {
  readonly id: string;
  readonly targetUserId: string;
  readonly nickname: string;
  readonly intro: string;
  readonly metadataLabel?: string;
  readonly facts: readonly RoommateSummaryCardFactViewModel[];
  readonly scoreLabel: string | null;
  readonly summaryOnly: boolean;
  readonly detailViewable: boolean;
  readonly resultReadLabel: string | null;
  readonly profileVisibilityBadge?: RoommateSummaryCardStatusBadgeViewModel | null;
  readonly actionStateLabel: string;
  readonly actionStateBadges?: readonly RoommateSummaryCardStatusBadgeViewModel[];
  readonly bookmarked: boolean;
  readonly bookmarkAction: RoommateBookmarkActionViewModel | null;
  readonly chatAction?: RoommateChatActionViewModel | null;
  readonly detailEntryToken: string | null;
}

interface SummaryFactSource {
  readonly smokingBehavior: string | null;
  readonly sleepHabit: string | null;
  readonly relationshipStyle: string | null;
}

export interface RoommateCardBookmarkStateOptions {
  readonly getBookmarked?: (targetUserId: string, fallback: boolean) => boolean;
  readonly isPending?: (targetUserId: string) => boolean;
  readonly summaryContextLabel?: string | null;
}

const EMPTY_INTRO_COPY = '아직 자기소개가 없어요.';
const HIDDEN_BOOKMARK_INTRO_COPY = '저장한 항목이 현재 정책상 보이지 않아요.';

export function mapRoommateSearchItemsToCardViewModels(
  items: readonly RoommateSearchSummary[],
  options: RoommateCardBookmarkStateOptions = {},
): readonly RoommateSummaryCardViewModel[] {
  return items.map((item) => mapRoommateSearchItemToCardViewModel(item, options));
}

export function mapRoommateSearchItemToCardViewModel(
  item: RoommateSearchSummary,
  options: RoommateCardBookmarkStateOptions = {},
): RoommateSummaryCardViewModel {
  const detailViewable = item.exposure.detailViewable && item.exposure.canViewFull;
  const fallbackBookmarked = item.bookmark?.bookmarked === true;
  const bookmarked = options.getBookmarked?.(item.id, fallbackBookmarked) ?? fallbackBookmarked;
  const pending = options.isPending?.(item.id) ?? false;
  const actionStateBadges = buildActionStateBadges(item.actions);
  const profileVisibilityBadge = buildProfileVisibilityBadge(detailViewable, item.actions);

  return {
    id: item.id,
    targetUserId: item.id,
    nickname: item.profileSummary.nickname,
    intro: normalizeIntro(item.profileSummary.intro),
    metadataLabel: buildSearchCardMetadataLabel(detailViewable, options.summaryContextLabel),
    facts: buildSummaryFacts(item.profileSummary),
    scoreLabel: buildScoreLabel(item),
    summaryOnly: !detailViewable,
    detailViewable,
    resultReadLabel: item.resultRead.resultReadable
      ? buildResultReadLabel(item.resultRead.context)
      : null,
    profileVisibilityBadge,
    actionStateLabel: buildActionStateLabel(item.actions),
    actionStateBadges,
    bookmarked,
    bookmarkAction: buildBookmarkAction({
      targetUserId: item.id,
      nickname: item.profileSummary.nickname,
      bookmarked,
      pending,
      visible: item.actions.canBookmark,
      disabled: pending,
    }),
    chatAction: buildChatAction({
      nickname: item.profileSummary.nickname,
      visible: item.actions.canStartChat,
    }),
    detailEntryToken: normalizeDetailEntryToken(item.detailEntryToken),
  };
}

export function mapBookmarkListItemsToCardViewModels(
  items: readonly BookmarkListItem[],
  options: RoommateCardBookmarkStateOptions = {},
): readonly RoommateSummaryCardViewModel[] {
  return items.map((item) => mapBookmarkListItemToCardViewModel(item, options));
}

export function mapBookmarkListItemToCardViewModel(
  item: BookmarkListItem,
  options: RoommateCardBookmarkStateOptions = {},
): RoommateSummaryCardViewModel {
  const profileSummary = item.visibility === 'VISIBLE' ? item.profileSummary : null;
  const fallbackBookmarked = true;
  const bookmarked =
    options.getBookmarked?.(item.targetUserId, fallbackBookmarked) ?? fallbackBookmarked;
  const pending = options.isPending?.(item.targetUserId) ?? false;
  const nickname = profileSummary ? profileSummary.nickname : '저장한 룸메이트';

  return {
    id: item.id,
    targetUserId: item.targetUserId,
    nickname,
    intro: profileSummary ? normalizeIntro(profileSummary.intro) : HIDDEN_BOOKMARK_INTRO_COPY,
    metadataLabel: '관심 목록',
    facts: profileSummary ? buildSummaryFacts(profileSummary) : [],
    scoreLabel: buildBookmarkScoreLabel(item),
    summaryOnly: true,
    detailViewable: false,
    resultReadLabel: null,
    profileVisibilityBadge: { label: '프로필 열람 불가', tone: 'amber' },
    actionStateLabel: profileSummary ? '관심 목록에서 관리 중' : '현재 정책상 요약을 볼 수 없어요',
    actionStateBadges: profileSummary
      ? [{ label: '관심 목록에서 관리 중', tone: 'slate' }]
      : [{ label: '현재 정책상 요약을 볼 수 없어요', tone: 'slate' }],
    bookmarked,
    bookmarkAction: buildBookmarkAction({
      targetUserId: item.targetUserId,
      nickname,
      bookmarked,
      pending,
      visible: true,
      disabled: pending,
    }),
    chatAction: null,
    detailEntryToken: null,
  };
}

function normalizeIntro(intro: string): string {
  const trimmed = intro.trim();
  return trimmed.length > 0 ? trimmed : EMPTY_INTRO_COPY;
}

function buildSummaryFacts(
  summary: SummaryFactSource,
): readonly RoommateSummaryCardFactViewModel[] {
  return [
    { label: '흡연 여부', value: smokingBehaviorLabel(summary.smokingBehavior) },
    { label: '잠버릇', value: sleepHabitLabel(summary.sleepHabit) },
    { label: '관계', value: relationshipStyleLabel(summary.relationshipStyle) },
  ];
}

function buildScoreLabel(item: RoommateSearchSummary): string | null {
  if (!item.exposure.scoreVisible) {
    if (item.exposure.detailViewable && item.exposure.canViewFull) {
      return '서버 오류';
    }
    return null;
  }
  if (typeof item.matchScore !== 'number') {
    return null;
  }
  return `매칭점수 ${item.matchScore}점`;
}

function buildSearchCardMetadataLabel(
  detailViewable: boolean,
  summaryContextLabel: string | null | undefined,
): string {
  const trimmed = summaryContextLabel?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  if (detailViewable) return '프로필 비교 가능';
  return '프로필 요약만 표시';
}

function buildBookmarkScoreLabel(item: BookmarkListItem): string | null {
  return typeof item.matchScore === 'number' ? `매칭점수 ${item.matchScore}점` : null;
}

function buildBookmarkAction(input: {
  targetUserId: string;
  nickname: string;
  bookmarked: boolean;
  pending: boolean;
  visible: boolean;
  disabled: boolean;
}): RoommateBookmarkActionViewModel | null {
  if (!input.visible) return null;
  const label = input.pending ? '저장 중' : input.bookmarked ? '관심 목록 해제' : '관심 목록 저장';
  return {
    visible: true,
    bookmarked: input.bookmarked,
    disabled: input.disabled,
    label,
    accessibilityLabel: `${input.nickname} ${label}`,
  };
}

function buildChatAction(input: {
  nickname: string;
  visible: boolean;
}): RoommateChatActionViewModel | null {
  if (!input.visible) return null;
  return {
    visible: true,
    label: '채팅하기',
    accessibilityLabel: `${input.nickname} 채팅하기`,
  };
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

function buildActionStateBadges(
  actions: PublicProfileActionCapabilities,
): readonly RoommateSummaryCardStatusBadgeViewModel[] {
  if (isDifferentDormitorySummary(actions)) {
    return [{ label: actionUnavailableReasonLabel('DIFFERENT_DORMITORY'), tone: 'slate' }];
  }

  const badges: RoommateSummaryCardStatusBadgeViewModel[] = [];

  if (actions.canStartChat) {
    badges.push({ label: '대화 가능', tone: 'green' });
  } else {
    badges.push({ label: '대화 불가', tone: 'slate' });
  }

  if (actions.canRequestMatch) {
    badges.push({ label: '매칭 신청 가능', tone: 'green' });
  } else {
    badges.push({ label: '매칭 신청 불가', tone: 'amber' });
    const reason = actions.unavailableReasons[0];
    if (reason) {
      badges.push({ label: actionUnavailableReasonLabel(reason), tone: 'slate' });
    }
  }

  if (badges.length === 0 && actions.canBookmark) {
    badges.push({ label: '관심 등록 가능', tone: 'slate' });
  }

  return badges.length > 0 ? badges : [{ label: '요약 정보만 표시', tone: 'slate' }];
}

function buildProfileVisibilityBadge(
  detailViewable: boolean,
  actions: PublicProfileActionCapabilities,
): RoommateSummaryCardStatusBadgeViewModel | null {
  if (isDifferentDormitorySummary(actions)) return null;
  return detailViewable
    ? { label: '프로필 열람 가능', tone: 'green' }
    : { label: '프로필 열람 불가', tone: 'amber' };
}

function isDifferentDormitorySummary(actions: PublicProfileActionCapabilities): boolean {
  return actions.unavailableReasons.includes('DIFFERENT_DORMITORY');
}

function actionUnavailableReasonLabel(reason: PublicTargetActionUnavailableReason): string {
  const labels: Record<PublicTargetActionUnavailableReason, string> = {
    VIEWER_NOT_REGISTERED: '시즌 등록 후 요청할 수 있어요',
    VIEWER_PROFILE_INCOMPLETE: '프로필 완성 후 요청할 수 있어요',
    VIEWER_NOT_ASSIGNED: '건물 배정 후 요청할 수 있어요',
    TARGET_NOT_PUBLIC: '상대가 공개 대상이 아니에요',
    DIFFERENT_DORMITORY: '다른 건물 유저는 프로필 요약만 확인 가능해요',
    VIEWER_ALREADY_MATCHED: '이미 매칭되어 새 요청이 닫혔어요',
    TARGET_ALREADY_MATCHED: '상대가 이미 매칭되어 새 요청이 닫혔어요',
    SEASON_NOT_ACTIONABLE: '매칭 기간에만 매칭이 가능해요',
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

function smokingBehaviorLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
  };
  return labels[value] ?? value;
}

function sleepHabitLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    NONE: '잠버릇 없음',
    TALKING: '잠버릇 있음',
    SNORING: '잠버릇 있음',
    GRINDING: '잠버릇 있음',
    HAS: '잠버릇 있음',
  };
  return labels[value] ?? value;
}

function relationshipStyleLabel(value: string | null): string {
  if (!value) return '비공개';
  const labels: Record<string, string> = {
    CLOSE: '친하게 지내요',
    CASUAL: '각자 생활해요',
    DISTANT: '각자 생활해요',
  };
  return labels[value] ?? value;
}
