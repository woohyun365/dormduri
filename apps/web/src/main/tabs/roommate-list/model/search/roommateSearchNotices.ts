import type {
  RoommateSearchAvailabilityNotice,
  RoommateSearchAvailabilityNoticeCode,
} from '@repo/shared/roommate-search/contract';

export type RoommateSearchNoticeSeverity = 'INFO' | 'WARNING';
export type RoommateSearchNoticeLiveRegion = 'polite' | 'off';

export interface RoommateSearchNoticeInput {
  readonly code: string;
  readonly severity?: RoommateSearchNoticeSeverity;
  readonly message?: string;
}

export interface RoommateSearchNoticeModel {
  readonly code: RoommateSearchAvailabilityNoticeCode | 'UNKNOWN_ROOMMATE_SEARCH_NOTICE';
  readonly severity: RoommateSearchNoticeSeverity;
  readonly title: string;
  readonly message: string;
  readonly liveRegion: RoommateSearchNoticeLiveRegion;
  readonly emptyState: boolean;
}

const NOTICE_COPY: Record<
  RoommateSearchAvailabilityNoticeCode,
  Pick<RoommateSearchNoticeModel, 'title' | 'message' | 'liveRegion' | 'emptyState'>
> = {
  MATCHED_TARGETS_EXCLUDED: {
    title: '이미 매칭된 사용자는 제외했어요',
    message: '현재 룸메이트 찾기 결과에는 이미 매칭된 사용자가 포함되지 않아요.',
    liveRegion: 'polite',
    emptyState: false,
  },
  DISCOVERY_ACTIONABLE_ONLY: {
    title: '요청 가능한 후보만 보여줘요',
    message: '지금 상세 확인과 요청이 가능한 후보 중심으로 결과를 조정했어요.',
    liveRegion: 'polite',
    emptyState: false,
  },
  SCOPE_RESTRICTED_BY_VIEWER_STATE: {
    title: '볼 수 있는 범위로 조정했어요',
    message: '현재 등록·기숙사·시즌 상태에 맞춰 룸메이트 찾기 범위를 제한했어요.',
    liveRegion: 'polite',
    emptyState: false,
  },
  POST_MATCH_ACTION_CLOSED: {
    title: '새 요청 기능이 닫힌 상태예요',
    message: '매칭 이후에는 회고용 목록만 제공되어 점수 정렬과 상세 필터를 열지 않아요.',
    liveRegion: 'polite',
    emptyState: false,
  },
  DETAIL_UNAVAILABLE_BY_POLICY: {
    title: '일부 상세 정보는 열 수 없어요',
    message: '프로필을 열람할 수 없는 후보는 요약 정보만 표시돼요.',
    liveRegion: 'polite',
    emptyState: false,
  },
  FILTER_RESULT_EMPTY: {
    title: '조건에 맞는 룸메이트가 아직 없어요.',
    message: '필터를 조금 넓히거나 새로고침 후 다시 확인해 보세요.',
    liveRegion: 'polite',
    emptyState: true,
  },
};

export function mapRoommateSearchAvailabilityNotices(
  notices: readonly (RoommateSearchAvailabilityNotice | RoommateSearchNoticeInput)[],
): readonly RoommateSearchNoticeModel[] {
  return notices.map(mapRoommateSearchAvailabilityNotice);
}

export function mapRoommateSearchAvailabilityNotice(
  notice: RoommateSearchAvailabilityNotice | RoommateSearchNoticeInput,
): RoommateSearchNoticeModel {
  if (isKnownNoticeCode(notice.code)) {
    const copy = NOTICE_COPY[notice.code];
    return {
      code: notice.code,
      severity: normalizeSeverity(notice.severity),
      ...copy,
    };
  }

  return {
    code: 'UNKNOWN_ROOMMATE_SEARCH_NOTICE',
    severity: normalizeSeverity(notice.severity),
    title: '룸메이트 찾기 안내',
    message: '현재 결과에 적용된 안내가 있어요. 필요한 경우 조건을 조정해 다시 확인해 주세요.',
    liveRegion: 'polite',
    emptyState: false,
  };
}

function isKnownNoticeCode(code: string): code is RoommateSearchAvailabilityNoticeCode {
  return code in NOTICE_COPY;
}

function normalizeSeverity(
  severity: RoommateSearchNoticeInput['severity'],
): RoommateSearchNoticeSeverity {
  return severity === 'WARNING' ? 'WARNING' : 'INFO';
}
