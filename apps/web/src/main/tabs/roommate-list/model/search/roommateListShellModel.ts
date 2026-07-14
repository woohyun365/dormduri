import { formatCampusName, formatGenderLabel } from '@/main/model/profileDisplayCopy';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';
import type { RoommateProfileDetailTarget } from '../../hooks/useRoommateProfileDetail';
import type { RoommateSearchStateSectionState } from '../../sections/empty-states/RoommateSearchStateSection';
import type { UseRoommateSearchResult } from '../../hooks/useRoommateSearch';
import type { RoommateSearchQueryCriteria } from './roommateSearchQuery';
import type { RoommateSummaryCardViewModel } from './roommateSearchViewModel';

const CLOSED_SEARCH_MESSAGE = '지난 시즌 룸메이트 찾기 탐색이 종료되었어요.';
const ENTRY_CLOSED_MESSAGE =
  '현재 상태에서는 룸메이트 찾기 탐색을 열 수 없어요. 시즌 참여 상태를 확인해 주세요.';
const CAMPUS_MERGED_EMPTY_TITLE = '시즌에 참여한 룸메이트가 아직 없어요.';
const CAMPUS_MERGED_EMPTY_MESSAGE = '시즌 등록을 마친 사용자가 생기면 이곳에 표시돼요.';
const SAME_BUILDING_EMPTY_TITLE = '조건에 맞는 룸메이트가 아직 없어요.';
const SAME_BUILDING_EMPTY_MESSAGE = '필터를 조금 넓히거나 새로고침 후 다시 확인해 보세요.';
const BOOKMARK_ONLY_EMPTY_TITLE = '아직 저장한 후보가 없어요.';
const BOOKMARK_ONLY_EMPTY_MESSAGE =
  '같은 건물 후보 카드의 북마크를 눌러 다시 볼 후보를 저장해 보세요.';
const REGISTRATION_REQUIRED_EMPTY_TITLE = '시즌 등록 후 같은 건물 후보를 볼 수 있어요.';
const REGISTRATION_REQUIRED_EMPTY_MESSAGE =
  '등록을 마치면 같은 건물 후보 리스트와 생활패턴 비교가 열려요.';
const OFF_SEASON_HEADER_TITLE = '룸메이트 찾기 준비 중';
const OFF_SEASON_HEADER_DESCRIPTION = '다음 시즌이 시작되면 안내할게요.';
const SEASON_OPEN_HEADER_TITLE = '룸메이트 찾기 오픈';
const SEASON_OPEN_HEADER_DESCRIPTION =
  '시즌 후보를 둘러보고, 같은 건물 후보는 생활패턴과 조건까지 비교해 볼 수 있어요.';
const DEFAULT_HEADER_DESCRIPTION =
  '원하는 룸메 조건을 바탕으로 생활패턴이 잘 맞는 후보를 탐색할 수 있어요.';

export function getRoommateSearchClosedMessage({
  seasonState,
  searchEntryAllowed,
  searchClosedMessage,
}: {
  readonly seasonState: SeasonContextValue['state'];
  readonly searchEntryAllowed: boolean;
  readonly searchClosedMessage?: string;
}): string | null {
  if (seasonState === 'OFF_SEASON') return CLOSED_SEARCH_MESSAGE;
  if (searchEntryAllowed) return null;
  return searchClosedMessage ?? ENTRY_CLOSED_MESSAGE;
}

export function getRoommateHeaderTitle(
  seasonState: SeasonContextValue['state'],
  assignedDormitoryName: string | null,
): string {
  if (seasonState === 'OFF_SEASON') return OFF_SEASON_HEADER_TITLE;
  if (seasonState === 'SEASON_OPEN') return SEASON_OPEN_HEADER_TITLE;
  return assignedDormitoryName ? `${assignedDormitoryName} 룸메이트` : '룸메이트 찾기';
}

export function getRoommateHeaderDescription(seasonState: SeasonContextValue['state']): string {
  if (seasonState === 'OFF_SEASON') return OFF_SEASON_HEADER_DESCRIPTION;
  if (seasonState === 'SEASON_OPEN') return SEASON_OPEN_HEADER_DESCRIPTION;
  return DEFAULT_HEADER_DESCRIPTION;
}

export function getSearchStateSectionState({
  search,
  closedMessage,
  activeSearchScope,
  showRegistrationEmptyPrompt,
  sameDormitoryRestrictedEmptyState,
}: {
  readonly search: UseRoommateSearchResult;
  readonly closedMessage: string | null;
  readonly activeSearchScope: UseRoommateSearchResult['query']['scope'];
  readonly showRegistrationEmptyPrompt: boolean;
  readonly sameDormitoryRestrictedEmptyState?: {
    readonly title: string;
    readonly message: string;
  };
}): RoommateSearchStateSectionState | null {
  if (closedMessage) {
    return { kind: 'closed', message: closedMessage };
  }

  if (search.status === 'error') {
    return {
      kind: 'error',
      message: search.error?.message ?? '룸메이트 찾기 정보를 불러오지 못했어요.',
      onRetry: () => void search.refresh(),
    };
  }

  if (
    search.status === 'idle' ||
    search.status === 'loading-manifest' ||
    search.status === 'loading-search'
  ) {
    return { kind: 'loading' };
  }

  if (search.items.length === 0) {
    if (showRegistrationEmptyPrompt) {
      return {
        kind: 'empty',
        title: sameDormitoryRestrictedEmptyState?.title ?? REGISTRATION_REQUIRED_EMPTY_TITLE,
        message: sameDormitoryRestrictedEmptyState?.message ?? REGISTRATION_REQUIRED_EMPTY_MESSAGE,
        tone: 'warning',
      };
    }

    const emptyNotice = search.notices.find((notice) => notice.emptyState);
    if (activeSearchScope === 'CAMPUS_MERGED') {
      return {
        kind: 'empty',
        title: CAMPUS_MERGED_EMPTY_TITLE,
        message: emptyNotice?.message ?? CAMPUS_MERGED_EMPTY_MESSAGE,
      };
    }

    return {
      kind: 'empty',
      title: SAME_BUILDING_EMPTY_TITLE,
      message: SAME_BUILDING_EMPTY_MESSAGE,
    };
  }

  return null;
}

export function getBookmarkOnlyEmptyState({
  enabled,
  status,
  itemCount,
}: {
  readonly enabled: boolean;
  readonly status: UseRoommateSearchResult['status'];
  readonly itemCount: number;
}): RoommateSearchStateSectionState | null {
  if (!enabled || status !== 'success' || itemCount > 0) return null;

  return {
    kind: 'empty',
    title: BOOKMARK_ONLY_EMPTY_TITLE,
    message: BOOKMARK_ONLY_EMPTY_MESSAGE,
  };
}

export function getInitialRoommateSearchQuery(
  registeredWithDormitory: boolean,
): Partial<RoommateSearchQueryCriteria> {
  return registeredWithDormitory
    ? { scope: 'SAME_BUILDING_ONLY', sort: 'MATCH_SCORE' }
    : { scope: 'CAMPUS_MERGED', sort: 'NICKNAME' };
}

export function getSearchSummaryContextLabel(
  search: UseRoommateSearchResult,
  user: UserProfile,
  assignedDormitoryName: string | null,
): string | null {
  const scope = search.response?.scope ?? search.query.scope;
  if (scope === 'CAMPUS_MERGED') return formatCampusName(user.campus);
  if (assignedDormitoryName) return `${assignedDormitoryName} (${formatGenderLabel(user.gender)})`;
  return null;
}

export function toDetailTarget(item: RoommateSummaryCardViewModel): RoommateProfileDetailTarget {
  return {
    targetUserId: item.targetUserId,
    nickname: item.nickname,
    detailEntryToken: item.detailEntryToken,
    pendingMatchRequest: item.pendingMatchRequest,
    dormitoryLabel: parseDormitoryLabel(item.metadataLabel),
  };
}

function parseDormitoryLabel(metadataLabel: string | undefined): string | null {
  const trimmed = metadataLabel?.trim();
  if (!trimmed || trimmed.includes('캠퍼스') || trimmed.includes('프로필')) return null;
  return trimmed.replace(/\s*\([^)]*\)\s*$/u, '');
}
