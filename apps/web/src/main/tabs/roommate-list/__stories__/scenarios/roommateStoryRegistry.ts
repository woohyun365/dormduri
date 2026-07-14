import type { PublicProfile } from '@repo/shared/profile/contract';
import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { BookmarkListResponse } from '@repo/shared/social-safety/bookmark';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { CreateReportResponse } from '@repo/shared/social-safety/report';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';
import type {
  RoommateStoryAutoOpen,
  RoommateStoryCategory,
  RoommateStoryScenario,
  RoommateStoryScenarioKey,
  RoommateStorySeasonGroup,
  RoommateStoryViewportHint,
} from '../fixtures/roommateStoryTypes';
import {
  TARGET_ERROR,
  TARGET_JIWOO,
  createManifestResponse,
  createSearchResponse,
  createSeasonContext,
  storyViewer,
} from '../fixtures/roommateStoryBuilders';
import {
  bookmarksEmpty,
  createBlockResponse,
  createMatchRequestActionResponse,
  createReportResponse,
  createPublicProfileFull,
  defaultProfiles,
  directionLimitReachedSummary,
  emptyIntroSummary,
  fullCompatibilityProfileByTargetUserId,
  seasonMatchingProfileByTargetUserId,
  seasonOpenProfileByTargetUserId,
} from '../fixtures/roommateStoryProfiles';
import {
  DEREGISTERED_SAME_DORMITORY_EMPTY_STATE,
  POST_MATCH_NOT_REGISTERED_SAME_DORMITORY_EMPTY_STATE,
  actionableSearch,
  blockedUserActionClosedSearch,
  campusMergedForUnregistered,
  emptyIntroDetailSearch,
  errorDetailSearch,
  fullCompatibilitySearch,
  postMatchCampusMerged,
  postMatchDeregisteredCampusMerged,
  postMatchDeregisteredSearchResponses,
  postMatchEmptySearchResponses,
  postMatchNotRegisteredSearchResponses,
  postMatchRegisteredSearchResponses,
  postMatchSameDormitory,
  postMatchSameDormitoryEmpty,
  scoreCalculationFailedSearch,
  seasonMatchingActiveMatchedSearchResponses,
  seasonMatchingDeregisteredSearchResponses,
  seasonMatchingNotRegisteredCampusMerged,
  seasonMatchingNotRegisteredEmptySearchResponses,
  seasonMatchingNotRegisteredSearchResponses,
  seasonMatchingPendingRequestsSearch,
  SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
  seasonMatchingRegisteredChattingSearch,
  seasonMatchingRegisteredChattingSearchResponses,
  seasonMatchingRegisteredEmpty,
  seasonMatchingRegisteredEmptySearchResponses,
  seasonMatchingRegisteredSameDormitory,
  seasonMatchingActiveMatchedSameDormitory,
  seasonMatchingDeregisteredCampusMerged,
  seasonMatchingNotRegisteredCampusMergedEmpty,
  seasonMatchingRegisteredSearchResponses,
  seasonMatchingUnmatchedSearch,
  seasonMatchingUnmatchedSearchResponses,
  seasonOpenDeregisteredCampusMerged,
  seasonOpenDeregisteredSearchResponses,
  seasonOpenNotRegisteredCampusMerged,
  seasonOpenNotRegisteredSearchResponses,
  seasonOpenRegisteredChattingSearch,
  seasonOpenRegisteredEmptySearchResponses,
  seasonOpenRegisteredSameDormitoryEmpty,
  seasonOpenRegisteredSameDormitory,
  seasonOpenRegisteredSearchResponses,
  tombstoneSearch,
  withSeasonBoundManifestResponse,
  withSeasonBoundSearchManifest,
  withSeasonBoundScopeResponses,
} from '../fixtures/roommateStorySearchResponses';

export function baseScenario(input: {
  key: RoommateStoryScenarioKey;
  title: string;
  description: string;
  category: RoommateStoryCategory;
  seasonGroup?: RoommateStorySeasonGroup;
  viewportHint?: RoommateStoryViewportHint;
  autoOpen?: RoommateStoryAutoOpen;
  searchEntryAllowed?: boolean;
  searchClosedMessage?: string;
  sameDormitoryRestrictedEmptyState?: {
    readonly title: string;
    readonly message: string;
  };
  searchResponse?: RoommateSearchResponse;
  searchResponsesByScope?: Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
  manifestResponse?: RoommateSearchManifestResponse;
  bookmarkResponse?: BookmarkListResponse;
  bookmarkError?: { code: string; status: number };
  profileByTargetUserId?: Readonly<Record<string, PublicProfile>>;
  profileErrorByTargetUserId?: Readonly<Record<string, { code: string; status: number }>>;
  matchRequestError?: { code: string; status: number };
  responseDelayMs?: number;
  blockResponse?: CreateBlockResponse;
  blockError?: { code: string; status: number };
  reportResponse?: CreateReportResponse;
  reportError?: { code: string; status: number };
  searchErrorCode?: string;
  searchErrorStatus?: number;
  searchResponseDelayMs?: number;
  profileResponseDelayMs?: number;
  seasonContext?: SeasonContextValue;
  viewer?: UserProfile;
}): RoommateStoryScenario {
  const seasonContext = input.seasonContext ?? createSeasonContext('SEASON_MATCHING');
  const searchResponse = withSeasonBoundSearchManifest(
    input.searchResponse ?? actionableSearch,
    seasonContext,
  );
  const searchResponsesByScope = withSeasonBoundScopeResponses(
    input.searchResponsesByScope,
    seasonContext,
  );
  const manifestResponse = input.manifestResponse
    ? withSeasonBoundManifestResponse(input.manifestResponse, seasonContext)
    : undefined;

  return {
    key: input.key,
    title: input.title,
    description: input.description,
    category: input.category,
    seasonGroup: input.seasonGroup ?? 'seasonMatching',
    viewportHint: input.viewportHint ?? 'mobile',
    ...(input.autoOpen ? { autoOpen: input.autoOpen } : {}),
    viewer: input.viewer ?? storyViewer,
    seasonContext,
    searchEntryAllowed: input.searchEntryAllowed ?? true,
    ...(input.searchClosedMessage ? { searchClosedMessage: input.searchClosedMessage } : {}),
    ...(input.sameDormitoryRestrictedEmptyState
      ? { sameDormitoryRestrictedEmptyState: input.sameDormitoryRestrictedEmptyState }
      : {}),
    searchResponse,
    ...(searchResponsesByScope ? { searchResponsesByScope } : {}),
    ...(manifestResponse ? { manifestResponse } : {}),
    ...(input.searchErrorCode ? { searchErrorCode: input.searchErrorCode } : {}),
    ...(input.searchErrorStatus ? { searchErrorStatus: input.searchErrorStatus } : {}),
    ...(typeof input.searchResponseDelayMs === 'number'
      ? { searchResponseDelayMs: input.searchResponseDelayMs }
      : {}),
    ...(typeof input.profileResponseDelayMs === 'number'
      ? { profileResponseDelayMs: input.profileResponseDelayMs }
      : {}),
    bookmarkResponse: input.bookmarkResponse ?? bookmarksEmpty,
    ...(input.bookmarkError ? { bookmarkError: input.bookmarkError } : {}),
    profileByTargetUserId: input.profileByTargetUserId ?? defaultProfiles,
    ...(input.profileErrorByTargetUserId
      ? { profileErrorByTargetUserId: input.profileErrorByTargetUserId }
      : {}),
    matchRequestResponse: createMatchRequestActionResponse(),
    ...(input.matchRequestError ? { matchRequestError: input.matchRequestError } : {}),
    ...(typeof input.responseDelayMs === 'number'
      ? { responseDelayMs: input.responseDelayMs }
      : {}),
    blockResponse: input.blockResponse ?? createBlockResponse(TARGET_JIWOO),
    ...(input.blockError ? { blockError: input.blockError } : {}),
    reportResponse: input.reportResponse ?? createReportResponse(false),
    ...(input.reportError ? { reportError: input.reportError } : {}),
  };
}

export const roommateStoryScenarios: Record<RoommateStoryScenarioKey, RoommateStoryScenario> = {
  offSeasonClosed: baseScenario({
    key: 'offSeasonClosed',
    title: 'Off Season / search preparation without building',
    description:
      '비시즌에는 타인 browse를 열지 않고 룸메이트 찾기 탭이 시즌 준비/이전 기록 안내로 닫히는 상태입니다.',
    category: 'search',
    seasonGroup: 'offSeason',
    seasonContext: createSeasonContext('OFF_SEASON'),
    searchEntryAllowed: false,
    viewer: { ...storyViewer, dormitoryId: null },
    searchResponse: campusMergedForUnregistered,
  }),
  seasonOpenRegistered: baseScenario({
    key: 'seasonOpenRegistered',
    title: 'Season Open + Registered / scope-controlled exploration',
    description:
      '시즌 등록을 마친 사용자가 캠퍼스 전체와 같은 건물 탐색 범위를 한 story에서 전환해 확인합니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenRegisteredSameDormitory,
    searchResponsesByScope: seasonOpenRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  seasonOpenRegisteredChatting: baseScenario({
    key: 'seasonOpenRegisteredChatting',
    title: 'Season Open + Registered / chatting candidate',
    description:
      '시즌 오픈 기간 같은 건물 후보 중 이미 대화가 진행 중인 상대를 대화 중 표시와 이어가기 버튼으로 보여줍니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenRegisteredChattingSearch,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  seasonOpenNotRegistered: baseScenario({
    key: 'seasonOpenNotRegistered',
    title: 'Season Open + Not Registered / scope-controlled preview',
    description:
      '시즌 등록 전 사용자가 캠퍼스 전체 둘러보기와 같은 건물 선택 시 등록 안내를 한 story에서 확인합니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenNotRegisteredCampusMerged,
    searchResponsesByScope: seasonOpenNotRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    viewer: { ...storyViewer, dormitoryId: null },
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  seasonOpenDeregistered: baseScenario({
    key: 'seasonOpenDeregistered',
    title: 'Season Open + De-registration / campus preview and same-dormitory limited',
    description:
      '시즌 오픈 기간에 참여를 철회한 사용자는 캠퍼스 전체 공개 요약은 볼 수 있고 같은 건물 후보·상세 비교는 제한 안내로 확인합니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    seasonContext: createSeasonContext('SEASON_OPEN'),
    viewer: { ...storyViewer, dormitoryId: null },
    searchResponse: seasonOpenDeregisteredCampusMerged,
    searchResponsesByScope: seasonOpenDeregisteredSearchResponses,
    sameDormitoryRestrictedEmptyState: DEREGISTERED_SAME_DORMITORY_EMPTY_STATE,
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  seasonOpenRegisteredEmpty: baseScenario({
    key: 'seasonOpenRegisteredEmpty',
    title: 'Season Open + Registered + candidate 0',
    description:
      '시즌 등록 완료 사용자가 캠퍼스 전체와 같은 건물 범위를 전환해도 후보가 0명일 때 empty 안내를 확인합니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenRegisteredSameDormitoryEmpty,
    searchResponsesByScope: seasonOpenRegisteredEmptySearchResponses,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  seasonOpenSearchError: baseScenario({
    key: 'seasonOpenSearchError',
    title: 'Season Open / retry-safe search error',
    description:
      '시즌 등록 상태와 무관하게 search fetch가 실패했을 때 검색 결과/필터 섹션 없이 main alert 재시도 카드만 노출합니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenRegisteredSameDormitory,
    searchResponsesByScope: seasonOpenRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
    searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
    searchErrorStatus: 503,
  }),
  seasonOpenLoadingSkeleton: baseScenario({
    key: 'seasonOpenLoadingSkeleton',
    title: 'Season Open + Loading Skeleton',
    description:
      '느린 네트워크에서 같은 건물 기본 목록과 우측 검색·필터 패널이 도착하기 전 스켈레톤을 보여주는 상태입니다.',
    category: 'search',
    seasonGroup: 'seasonOpen',
    searchResponse: seasonOpenRegisteredSameDormitory,
    searchResponsesByScope: seasonOpenRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_OPEN'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
    searchResponseDelayMs: 20_000,
  }),
  seasonMatchingRegistered: baseScenario({
    key: 'seasonMatchingRegistered',
    title: 'Season Matching + Registered / scope-controlled exploration',
    description:
      '매칭 기간 등록 완료 사용자가 캠퍼스 전체와 같은 건물 탐색 범위를 한 story에서 전환해 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    searchResponsesByScope: seasonMatchingRegisteredSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingRegisteredChatting: baseScenario({
    key: 'seasonMatchingRegisteredChatting',
    title: 'Season Matching + Registered / chatting candidate',
    description:
      '매칭 기간 같은 건물 후보 중 이미 대화가 진행 중인 상대를 대화 중 표시와 이어가기 버튼으로 보여줍니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredChattingSearch,
    searchResponsesByScope: seasonMatchingRegisteredChattingSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingActiveMatched: baseScenario({
    key: 'seasonMatchingActiveMatched',
    title: 'Season Matching + Active Matched / summary-only search',
    description:
      '매칭이 확정된 viewer가 캠퍼스 전체와 같은 건물 후보 리스트를 요약으로만 확인하고 새 action은 닫힌 상태를 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingActiveMatchedSameDormitory,
    searchResponsesByScope: seasonMatchingActiveMatchedSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingUnmatched: baseScenario({
    key: 'seasonMatchingUnmatched',
    title: 'Season Matching + Unmatched / discovery reopened',
    description:
      '확정 매칭이 상호 해제된 뒤 active match가 없는 viewer가 cooldown/횟수 제한을 반영한 신규 후보 탐색으로 돌아온 상태입니다.',
    category: 'search',
    searchResponse: seasonMatchingUnmatchedSearch,
    searchResponsesByScope: seasonMatchingUnmatchedSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingDeregistered: baseScenario({
    key: 'seasonMatchingDeregistered',
    title: 'Season Matching + De-registration / campus preview and same-dormitory limited',
    description:
      '매칭 기간에 active match 없이 시즌 참여를 철회한 사용자는 캠퍼스 전체 공개 요약은 볼 수 있고 같은 건물 후보·매칭 action은 제한됩니다.',
    category: 'search',
    seasonContext: createSeasonContext('SEASON_MATCHING'),
    viewer: { ...storyViewer, dormitoryId: null },
    searchResponse: seasonMatchingDeregisteredCampusMerged,
    searchResponsesByScope: seasonMatchingDeregisteredSearchResponses,
    sameDormitoryRestrictedEmptyState: DEREGISTERED_SAME_DORMITORY_EMPTY_STATE,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingNotRegistered: baseScenario({
    key: 'seasonMatchingNotRegistered',
    title: 'Season Matching + Not Registered / campus summary preview',
    description:
      '매칭 기간 등록 전 사용자가 캠퍼스 전체 둘러보기와 같은 건물 선택 시 등록 안내를 한 story에서 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingNotRegisteredCampusMerged,
    searchResponsesByScope: seasonMatchingNotRegisteredSearchResponses,
    viewer: { ...storyViewer, dormitoryId: null },
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingNotRegisteredEmpty: baseScenario({
    key: 'seasonMatchingNotRegisteredEmpty',
    title: 'Season Matching + Not Registered + candidate 0',
    description:
      '매칭 기간 등록 전 사용자가 캠퍼스 통합 공개 요약 범위에서 확인 가능한 후보가 없을 때 empty 안내를 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingNotRegisteredCampusMergedEmpty,
    searchResponsesByScope: seasonMatchingNotRegisteredEmptySearchResponses,
    viewer: { ...storyViewer, dormitoryId: null },
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingRegisteredEmpty: baseScenario({
    key: 'seasonMatchingRegisteredEmpty',
    title: 'Season Matching + Registered + candidate 0',
    description:
      '매칭 기간 등록 완료 사용자가 캠퍼스 전체와 같은 건물 범위를 전환해도 후보가 0명일 때 empty 안내를 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredEmpty,
    searchResponsesByScope: seasonMatchingRegisteredEmptySearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingSearchError: baseScenario({
    key: 'seasonMatchingSearchError',
    title: 'Season Matching / retry-safe search error',
    description:
      '매칭 기간 search BFF 실패 시 등록 상태와 무관하게 raw upstream detail 없이 사용자 재시도 안내만 노출합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    searchResponsesByScope: seasonMatchingRegisteredSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
    searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
    searchErrorStatus: 503,
  }),
  seasonMatchingLoadingSkeleton: baseScenario({
    key: 'seasonMatchingLoadingSkeleton',
    title: 'Season Matching + Loading Skeleton',
    description:
      '매칭 기간 같은 건물 기본 목록과 검색·필터 패널이 도착하기 전 스켈레톤을 보여주는 상태입니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    searchResponsesByScope: seasonMatchingRegisteredSearchResponses,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
    searchResponseDelayMs: 20_000,
  }),
  seasonMatchingDetailFullCompatibility: baseScenario({
    key: 'seasonMatchingDetailFullCompatibility',
    title: 'Season Matching + Registered / detail full compatibility',
    description:
      '동일한 viewer condition 기준으로 9명 후보의 잘 맞음·조율 가능·서로 다름·유동적 조합과 FULL detail 시각화를 함께 확인합니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: fullCompatibilitySearch,
    profileByTargetUserId: fullCompatibilityProfileByTargetUserId,
  }),
  seasonMatchingDetailPending: baseScenario({
    key: 'seasonMatchingDetailPending',
    title: 'Season Matching + Registered / detail pending',
    description:
      '같은 건물 후보의 프로필 상세를 여는 동안 공개 가능 정보 확인을 기다리는 pending UI를 확인합니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: fullCompatibilitySearch,
    profileByTargetUserId: fullCompatibilityProfileByTargetUserId,
    profileResponseDelayMs: 20_000,
  }),
  seasonMatchingDetailEmptyIntro: baseScenario({
    key: 'seasonMatchingDetailEmptyIntro',
    title: 'Season Matching + Registered / detail without intro',
    description:
      'intro를 작성하지 않은 같은 건물 후보가 summary card와 profile detail 모두에서 빈 영역 없이 기본 안내 문구로 보이는 상태입니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: emptyIntroDetailSearch,
    profileByTargetUserId: {
      ...defaultProfiles,
      [emptyIntroSummary.id]: createPublicProfileFull({
        id: emptyIntroSummary.id,
        nickname: emptyIntroSummary.profileSummary.nickname,
        intro: '',
        matchScore: emptyIntroSummary.matchScore,
      }),
    },
  }),
  seasonMatchingExceptionScoreCalculationFailed: baseScenario({
    key: 'seasonMatchingExceptionScoreCalculationFailed',
    title: 'Season Matching 예외 / 서버 점수 계산 오류',
    description:
      '서버가 매칭점수 계산 결과를 제공하지 못했을 때 카드에는 오류 pill을 두고 상세 비교 영역은 amber 안내로 닫습니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: scoreCalculationFailedSearch,
    profileByTargetUserId: {
      ...defaultProfiles,
      [TARGET_JIWOO]: createPublicProfileFull({
        id: TARGET_JIWOO,
        nickname: '지우',
        intro: '아침형이고 조용한 방 분위기를 좋아해요.',
        scoreVisible: false,
      }),
    },
  }),
  seasonMatchingExceptionDetailFetchFailed: baseScenario({
    key: 'seasonMatchingExceptionDetailFetchFailed',
    title: 'Season Matching 예외 / 프로필 상세 연결 실패',
    description:
      '목록은 렌더링됐지만 상세 API 연결이 실패해 최신 목록 확인과 재시도를 안내하는 상태입니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: actionableSearch,
    profileErrorByTargetUserId: {
      [TARGET_JIWOO]: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
    },
  }),
  seasonMatchingExceptionDetailUnavailable: baseScenario({
    key: 'seasonMatchingExceptionDetailUnavailable',
    title: 'Season Matching 예외 / 시즌 참여 철회',
    description:
      '목록 카드에는 기존 점수가 보이지만 상세를 여는 사이 상대가 시즌 참여를 철회해 상세 화면이 안내로 닫히는 상태입니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: tombstoneSearch,
  }),
  seasonMatchingExceptionAccessRecheckFailed: baseScenario({
    key: 'seasonMatchingExceptionAccessRecheckFailed',
    title: 'Season Matching 예외 / 서버 재확인 실패',
    description:
      '상세 요청이 서버에서 안전하게 완료되지 못했을 때 대상 여부를 드러내지 않고 새로고침 안내만 표시합니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: errorDetailSearch,
    profileErrorByTargetUserId: {
      [TARGET_ERROR]: { code: 'PROFILE_NOT_VISIBLE', status: 404 },
    },
  }),
  seasonMatchingMatchRequestDialog: baseScenario({
    key: 'seasonMatchingMatchRequestDialog',
    title: 'Season Matching + Registered / Match Request Dialog',
    description:
      '매칭 기간 같은 건물 후보 상세에서 매칭 요청 dialog와 요청 메시지 입력/글자 수 제한을 확인합니다.',
    category: 'action',
    autoOpen: 'match-request-dialog',
  }),
  seasonMatchingMatchRequestPending: baseScenario({
    key: 'seasonMatchingMatchRequestPending',
    title: 'Season Matching + Registered / Request Pending',
    description:
      '매칭 요청 전송 중 dialog submit 버튼이 pending label과 disabled 상태로 중복 제출을 막는지 확인합니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
    responseDelayMs: 20_000,
  }),
  seasonMatchingMatchRequestSuccess: baseScenario({
    key: 'seasonMatchingMatchRequestSuccess',
    title: 'Season Matching + Registered / Request Success',
    description:
      '매칭 요청을 보낸 뒤 dialog와 상세를 닫고 화면 위에 떠 있는 성공 안내를 확인합니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
  }),
  seasonMatchingPendingRequests: baseScenario({
    key: 'seasonMatchingPendingRequests',
    title: 'Season Matching + Registered / Pending Request Status',
    description:
      '내가 이미 요청을 보낸 후보와 나에게 요청을 보낸 후보가 search summary pill과 상세 CTA에서 새 요청을 막는 상태를 확인합니다.',
    category: 'action',
    searchResponse: seasonMatchingPendingRequestsSearch,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingMatchRequestFailed: baseScenario({
    key: 'seasonMatchingMatchRequestFailed',
    title: 'Season Matching + Registered / Request Failed',
    description:
      '일시적인 요청 처리 실패가 발생했을 때 dialog 내부에 실패 메시지를 남기고 다시 시도할 수 있는 상태입니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
    matchRequestError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
  }),
  seasonMatchingMatchRequestAlreadyPending: baseScenario({
    key: 'seasonMatchingMatchRequestAlreadyPending',
    title: 'Season Matching / Stale Pending Request Race (Already Pending 예외)',
    description:
      '최신 search summary에는 pending 상태가 반영되어야 하지만, 오래된 상세 dialog나 다른 탭 race로 중복 요청이 서버에서 거절되는 예외 복구 상태입니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
    matchRequestError: { code: 'MATCH_REQUEST_ALREADY_PENDING', status: 409 },
  }),
  seasonMatchingMatchRequestLimitReached: baseScenario({
    key: 'seasonMatchingMatchRequestLimitReached',
    title: 'Season Matching + Registered / Request Limit Reached',
    description:
      'viewer to target 방향 요청 횟수를 모두 사용한 후보가 search summary pill과 상세의 blocked CTA로 매칭 요청 불가 사유를 보여주는 상태입니다.',
    category: 'action',
    autoOpen: 'detail',
    searchResponse: createSearchResponse({
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
      items: [directionLimitReachedSummary],
      scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
    }),
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingMatchRequestTargetMatched: baseScenario({
    key: 'seasonMatchingMatchRequestTargetMatched',
    title: 'Season Matching 예외 / 전송 직전 상대 매칭 완료',
    description:
      '후보 목록에는 있었지만 매칭 요청 전송 직전에 상대가 다른 사용자와 매칭되어 요청이 닫히는 복구 상태입니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
    matchRequestError: { code: 'ACTIVE_MATCH_ALREADY_EXISTS', status: 409 },
  }),
  seasonMatchingMatchRequestTargetDeregistered: baseScenario({
    key: 'seasonMatchingMatchRequestTargetDeregistered',
    title: 'Season Matching 예외 / 전송 직전 시즌 등록 철회',
    description:
      '매칭 요청 전송 직전에 상대가 시즌 등록을 철회해 dialog 내부 안내와 목록 재조회로 복구하는 상태입니다.',
    category: 'action',
    autoOpen: 'match-request-submit',
    matchRequestError: { code: 'MATCH_REQUEST_TARGET_NOT_FOUND', status: 404 },
  }),
  seasonMatchingBookmarkStaleFailure: baseScenario({
    key: 'seasonMatchingBookmarkStaleFailure',
    title: 'Season Matching 예외 / 관심 목록 저장 직전 대상 상태 변경',
    description:
      '관심 목록 저장 직전에 상대가 더 이상 저장 가능한 대상이 아니게 되어 낙관적 상태를 되돌리고 최신 목록 확인 안내를 보여주는 상태입니다.',
    category: 'action',
    autoOpen: 'bookmark-toggle',
    bookmarkError: { code: 'TARGET_NOT_BOOKMARKABLE', status: 404 },
  }),
  seasonMatchingActionBlockedUser: baseScenario({
    key: 'seasonMatchingActionBlockedUser',
    title: 'Season Matching 예외 / blocked user action closed',
    description:
      '차단 관계나 안전 제한으로 남아 있는 후보 카드에서 상세/대화/요청 행동이 모두 닫힌 상태를 확인합니다.',
    category: 'action',
    searchResponse: blockedUserActionClosedSearch,
  }),
  seasonMatchingBlockDialog: baseScenario({
    key: 'seasonMatchingBlockDialog',
    title: 'Season Matching + Registered / block dialog',
    description:
      '매칭 기간 같은 건물 후보 상세에서 차단 확인 dialog와 optional memo copy를 확인합니다.',
    category: 'action',
    autoOpen: 'block-dialog',
  }),
  seasonMatchingBlockPending: baseScenario({
    key: 'seasonMatchingBlockPending',
    title: 'Season Matching + Registered / block pending',
    description: '차단 제출 후 응답을 기다리는 동안 dialog 내부 pending 버튼 상태를 확인합니다.',
    category: 'action',
    autoOpen: 'block-submit',
    responseDelayMs: 20_000,
  }),
  seasonMatchingBlockFailed: baseScenario({
    key: 'seasonMatchingBlockFailed',
    title: 'Season Matching + Registered / block failed',
    description:
      '차단 제출이 실패했을 때 dialog 내부에 실패 메시지를 남기고 다시 제출할 수 있는 상태입니다.',
    category: 'action',
    autoOpen: 'block-submit',
    blockError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
  }),
  seasonMatchingBlockSuccessReceipt: baseScenario({
    key: 'seasonMatchingBlockSuccessReceipt',
    title: 'Season Matching + Registered / block success receipt',
    description:
      '매칭 기간 차단 성공 후 상세를 닫고 같은 건물 후보 목록 refresh 기준의 receipt를 보여줍니다.',
    category: 'action',
    autoOpen: 'block-submit',
  }),
  seasonMatchingReportDialog: baseScenario({
    key: 'seasonMatchingReportDialog',
    title: 'Season Matching + Registered / report dialog',
    description:
      '매칭 기간 같은 건물 후보 신고 사유, 상세 입력, optional block, 허위 신고 안내를 한 화면에서 확인합니다.',
    category: 'action',
    autoOpen: 'report-dialog',
    viewportHint: 'long-content',
  }),
  seasonMatchingReportPending: baseScenario({
    key: 'seasonMatchingReportPending',
    title: 'Season Matching + Registered / report pending',
    description:
      '신고 접수 응답을 기다리는 동안 dialog 내부 pending 버튼 상태와 입력 비활성화를 확인합니다.',
    category: 'action',
    autoOpen: 'report-submit',
    viewportHint: 'long-content',
    responseDelayMs: 20_000,
  }),
  seasonMatchingReportFailed: baseScenario({
    key: 'seasonMatchingReportFailed',
    title: 'Season Matching + Registered / report failed',
    description:
      '신고 접수가 실패했을 때 dialog 내부에 실패 메시지를 남기고 다시 제출할 수 있는 상태입니다.',
    category: 'action',
    autoOpen: 'report-submit',
    viewportHint: 'long-content',
    reportError: { code: 'BFF_UPSTREAM_UNAVAILABLE', status: 503 },
  }),
  seasonMatchingReportSuccessReceipt: baseScenario({
    key: 'seasonMatchingReportSuccessReceipt',
    title: 'Season Matching + Registered / report success receipt',
    description:
      '신고 접수 성공 후 dialog를 닫고 후속 조치 비공개 안내 receipt를 보여주는 상태입니다.',
    category: 'action',
    autoOpen: 'report-submit',
    viewportHint: 'long-content',
  }),
  seasonMatchingReportOptionalBlockReceipt: baseScenario({
    key: 'seasonMatchingReportOptionalBlockReceipt',
    title: 'Season Matching + Registered / report with optional block receipt',
    description: '매칭 기간 신고 접수와 선택 차단 성공 후 intake-only receipt copy를 확인합니다.',
    category: 'action',
    autoOpen: 'report-optional-block-submit',
    viewportHint: 'long-content',
    reportResponse: createReportResponse(true),
  }),
  postMatchRegistered: baseScenario({
    key: 'postMatchRegistered',
    title: 'Post Match + Registered / summary browse',
    description:
      '시즌 등록 이력이 있는 사용자가 캠퍼스 전체 요약과 같은 건물 시즌 참여자 목록을 전환해 확인합니다. 새 요청·상세 비교·점수 정렬은 닫힙니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchSameDormitory,
    searchResponsesByScope: postMatchRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  postMatchNotRegistered: baseScenario({
    key: 'postMatchNotRegistered',
    title: 'Post Match + Not Registered / campus summary preview',
    description:
      '시즌 등록 이력이 없는 사용자는 캠퍼스 전체 공개 요약만 확인하고, 같은 건물 목록은 등록 이력 안내로 닫히는 상태입니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchCampusMerged,
    searchResponsesByScope: postMatchNotRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    viewer: { ...storyViewer, dormitoryId: null },
    sameDormitoryRestrictedEmptyState: POST_MATCH_NOT_REGISTERED_SAME_DORMITORY_EMPTY_STATE,
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  postMatchDeregistered: baseScenario({
    key: 'postMatchDeregistered',
    title: 'Post Match + De-registration / campus summary and restricted same-dormitory',
    description:
      '시즌 참여를 철회한 사용자는 캠퍼스 전체 공개 요약은 볼 수 있고 같은 건물 시즌 참여자 목록은 철회 안내로 닫히는 상태입니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchDeregisteredCampusMerged,
    searchResponsesByScope: postMatchDeregisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    viewer: { ...storyViewer, dormitoryId: null },
    sameDormitoryRestrictedEmptyState: DEREGISTERED_SAME_DORMITORY_EMPTY_STATE,
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  postMatchEmpty: baseScenario({
    key: 'postMatchEmpty',
    title: 'Post Match + Empty',
    description:
      '포스트매치 결과 정리 기간에 캠퍼스 전체와 같은 건물 목록 모두 표시할 사용자가 없을 때 empty 안내를 확인합니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchSameDormitoryEmpty,
    searchResponsesByScope: postMatchEmptySearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    profileByTargetUserId: seasonOpenProfileByTargetUserId,
  }),
  postMatchSearchError: baseScenario({
    key: 'postMatchSearchError',
    title: 'Post Match / retry-safe search error',
    description:
      '포스트매치 search BFF 실패 시 검색 결과/필터 섹션 없이 사용자 재시도 안내만 노출합니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchCampusMerged,
    searchResponsesByScope: postMatchRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
    searchErrorStatus: 503,
  }),
  postMatchLoadingSkeleton: baseScenario({
    key: 'postMatchLoadingSkeleton',
    title: 'Post Match + Loading Skeleton',
    description:
      '느린 네트워크에서 포스트매치 요약 목록과 검색 결과 패널이 도착하기 전 스켈레톤을 보여주는 상태입니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatchSameDormitory,
    searchResponsesByScope: postMatchRegisteredSearchResponses,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
    searchResponseDelayMs: 20_000,
  }),
};

export function createRoommateStoryManifestResponse(
  scenario: RoommateStoryScenario,
  requestedScope: RoommateSearchScope | null = null,
): RoommateSearchManifestResponse {
  const response =
    (requestedScope ? scenario.searchResponsesByScope?.[requestedScope] : null) ??
    scenario.searchResponse;

  return (
    scenario.manifestResponse ??
    createManifestResponse(
      response.scope,
      response.manifest.purpose,
      response.availabilityNotices,
      response.scopeAvailability,
      scenario.seasonContext,
    )
  );
}
