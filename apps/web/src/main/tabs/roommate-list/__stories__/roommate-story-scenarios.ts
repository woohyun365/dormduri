import { CHUNCHEON_COLLEGE_CATALOG } from '@repo/shared/college';
import {
  ROOMMATE_SEARCH_MIN_SCORE_PRESETS,
  type RoommateSearchAvailabilityNotice,
  type RoommateSearchManifest,
  type RoommateSearchManifestResponse,
  type RoommateSearchPurpose,
  type RoommateSearchResponse,
  type RoommateSearchScope,
  type RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';
import type { MatchRequestActionResponse, MatchRequestSummary } from '@repo/shared/match/contract';
import type {
  PublicProfile,
  PublicProfileActionCapabilities,
  PublicProfileFullDetail,
  PublicProfileTombstone,
  PublicTargetExposure,
  PublicTargetRelation,
  PublicTargetResultRead,
} from '@repo/shared/profile/contract';
import type { BookmarkListResponse } from '@repo/shared/social-safety/bookmark';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { CreateReportResponse } from '@repo/shared/social-safety/report';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';

const ROOMMATE_STORY_AGE_BAND_CODES = ['20', '21', '22', '23', '24', '25_PLUS'] as const;

export type RoommateStoryCategory = 'search' | 'detail' | 'action' | 'responsive';
export type RoommateStorySeasonGroup = 'offSeason' | 'seasonOpen' | 'seasonMatching' | 'postMatch';
export type RoommateStoryAutoOpen =
  | 'filter-sheet'
  | 'detail'
  | 'match-request-dialog'
  | 'match-request-stale-submit'
  | 'block-dialog'
  | 'block-submit'
  | 'report-dialog'
  | 'report-optional-block-submit';
export type RoommateStoryViewportHint = 'mobile' | 'desktop' | 'long-content';

export interface RoommateStoryScenario {
  readonly key: RoommateStoryScenarioKey;
  readonly title: string;
  readonly description: string;
  readonly category: RoommateStoryCategory;
  readonly seasonGroup: RoommateStorySeasonGroup;
  readonly viewportHint: RoommateStoryViewportHint;
  readonly autoOpen?: RoommateStoryAutoOpen;
  readonly searchEntryAllowed?: boolean;
  readonly viewer: UserProfile;
  readonly seasonContext: SeasonContextValue;
  readonly searchResponse: RoommateSearchResponse;
  readonly searchResponsesByScope?: Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
  readonly manifestResponse?: RoommateSearchManifestResponse;
  readonly searchErrorCode?: string;
  readonly searchErrorStatus?: number;
  readonly searchResponseDelayMs?: number;
  readonly bookmarkResponse: BookmarkListResponse;
  readonly profileByTargetUserId: Readonly<Record<string, PublicProfile>>;
  readonly profileErrorByTargetUserId?: Readonly<Record<string, { code: string; status: number }>>;
  readonly matchRequestResponse: MatchRequestActionResponse;
  readonly matchRequestError?: { code: string; status: number };
  readonly responseDelayMs?: number;
  readonly blockResponse: CreateBlockResponse;
  readonly reportResponse: CreateReportResponse;
}

export const ROOMMATE_STORY_SCENARIO_KEYS = [
  'offSeasonClosed',
  'seasonOpenRegistered',
  'seasonOpenNotRegistered',
  'seasonOpenRegisteredEmpty',
  'seasonOpenSearchError',
  'seasonOpenLoadingSkeleton',
  'seasonMatchingRegistered',
  'seasonMatchingNotRegistered',
  'seasonMatchingNotRegisteredEmpty',
  'seasonMatchingRegisteredEmpty',
  'seasonMatchingSearchError',
  'seasonMatchingLoadingSkeleton',
  'seasonMatchingDetailFullCompatibility',
  'seasonMatchingExceptionScoreCalculationFailed',
  'seasonMatchingExceptionDetailUnavailable',
  'seasonMatchingExceptionAccessRecheckFailed',
  'seasonMatchingMatchRequestDialog',
  'seasonMatchingMatchRequestStaleError',
  'seasonMatchingBlockDialog',
  'seasonMatchingBlockSuccessReceipt',
  'seasonMatchingReportDialog',
  'seasonMatchingReportOptionalBlockReceipt',
  'seasonMatchingMobileBookmarkIconState',
  'seasonMatchingActionPendingDisabled',
  'postMatchCohortReview',
] as const;

export type RoommateStoryScenarioKey = (typeof ROOMMATE_STORY_SCENARIO_KEYS)[number];

export const ROOMMATE_STORY_CATEGORY_KEYS = {
  search: [
    'offSeasonClosed',
    'seasonOpenRegistered',
    'seasonOpenNotRegistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
    'seasonMatchingRegistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'postMatchCohortReview',
  ],
  detail: [
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
  ],
  action: [
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestStaleError',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportOptionalBlockReceipt',
    'seasonMatchingMobileBookmarkIconState',
    'seasonMatchingActionPendingDisabled',
  ],
  responsive: ['seasonMatchingMobileBookmarkIconState', 'seasonMatchingReportDialog'],
} as const satisfies Record<RoommateStoryCategory, readonly RoommateStoryScenarioKey[]>;

export const ROOMMATE_STORY_SEASON_GROUP_KEYS = {
  offSeason: ['offSeasonClosed'],
  seasonOpen: [
    'seasonOpenRegistered',
    'seasonOpenNotRegistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
  ],
  seasonMatching: [
    'seasonMatchingRegistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestStaleError',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportOptionalBlockReceipt',
    'seasonMatchingMobileBookmarkIconState',
    'seasonMatchingActionPendingDisabled',
  ],
  postMatch: ['postMatchCohortReview'],
} as const satisfies Record<RoommateStorySeasonGroup, readonly RoommateStoryScenarioKey[]>;

const ISO_NOW = '2026-07-06T03:00:00.000Z';
const TARGET_JIWOO = 'story-roommate-jiwoo';
const TARGET_HAYOON = 'story-roommate-hayoon';
const TARGET_CAMPUS = 'story-roommate-campus-preview';
const TARGET_POST = 'story-roommate-post-match';
const TARGET_TOMBSTONE = 'story-roommate-tombstone';
const TARGET_ERROR = 'story-roommate-hidden';

const GENERAL_RELATION: PublicTargetRelation = { type: 'GENERAL' };
const MATCHED_RELATION: PublicTargetRelation = { type: 'MATCHED_PARTNER' };
const FULL_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: true,
  canViewFull: true,
  scoreVisible: true,
};
const SUMMARY_ONLY_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: false,
  canViewFull: false,
  scoreVisible: false,
};
const TOMBSTONE_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: false,
  canViewFull: false,
  scoreVisible: false,
};
const RESULT_READ: PublicTargetResultRead = {
  resultReadable: true,
  context: 'CURRENT_MATCHED_PARTNER',
};
const NO_RESULT_READ: PublicTargetResultRead = { resultReadable: false, context: 'NONE' };
const ACTIONABLE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: true,
  canStartChat: true,
  unavailableReasons: [],
};
const SEASON_OPEN_SAME_DORMITORY_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: false,
  canStartChat: true,
  unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
};
const SUMMARY_ONLY_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['DIFFERENT_DORMITORY'],
};
const POST_MATCH_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: true,
  unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
};
const TOMBSTONE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['TARGET_DELETED_OR_DEIDENTIFIED'],
};

const storyViewer: UserProfile = {
  id: 'story-viewer-user',
  nickname: '스토리뷰어',
  gender: 'F',
  campus: 'CHUNCHEON',
  dormitoryId: 'yeji',
  intro: '조용한 생활 리듬을 선호해요.',
  messageToRoommate: null,
  additional: {
    college: 'IT',
    grade: '3',
    mbti: 'INFJ',
    birthYear: 2002,
  },
  lifestyle: {
    bedtime: '22_24',
    wakeTime: '07_08',
    sleepHabit: 'NONE',
    sleepEnvironment: 'QUIET',
    screenUsage: 'NONE',
    noiseSensitivity: 'SENSITIVE',
    smokingBehavior: 'NO',
    indoorEating: 'SNACK',
    phoneBehavior: 'RARELY',
    earphoneUsage: 'ALWAYS',
    cleanLevel: 'WEEKLY_3_UP',
    drinkingFrequency: 'RARELY',
    relationshipStyle: 'CASUAL',
    temperatureSensitivity: 'NORMAL',
    smokingTolerance: 'NO_ONLY',
    phoneTolerance: 'BRIEF_OK',
    earphoneExpectation: 'MUST',
    sleepEnvPreference: 'NO_SPEAKER',
    screenTolerance: 'NO_SCREEN',
    indoorEatingTolerance: 'CLEAN_OK',
    cleanExpectation: 'BASIC',
    drinkingTolerance: 'LOW_ONLY',
  },
};

function createSeasonContext(state: SeasonContextValue['state']): SeasonContextValue {
  return {
    season: {
      name: '2026년 2학기',
      roomSelectionDate: '2026-08-06',
    },
    state,
    isOpen: state === 'SEASON_OPEN',
    isMatching: state === 'SEASON_MATCHING',
    daysUntilEnd: state === 'SEASON_POST_MATCH' ? 0 : 31,
  };
}

export function resolveRoommateStorySeasonReferenceYear(
  seasonContext: SeasonContextValue,
): number | null {
  return (
    parseRoommateStorySeasonYear(seasonContext.season.roomSelectionDate) ??
    parseRoommateStorySeasonYear(seasonContext.season.name)
  );
}

export function createRoommateStoryAgeBandOptions(seasonContext: SeasonContextValue) {
  const seasonReferenceYear = resolveRoommateStorySeasonReferenceYear(seasonContext);

  return ROOMMATE_STORY_AGE_BAND_CODES.map((value) => ({
    code: value,
    label: formatRoommateStoryAgeBandLabel(value, seasonReferenceYear),
  }));
}

function parseRoommateStorySeasonYear(value: string): number | null {
  const match = /(\d{4})/u.exec(value);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatRoommateStoryAgeBandLabel(
  value: (typeof ROOMMATE_STORY_AGE_BAND_CODES)[number],
  seasonReferenceYear: number | null,
): string {
  const ageLabel = value === '25_PLUS' ? '25세 이상' : `${value}세`;
  if (!seasonReferenceYear) {
    return ageLabel;
  }

  if (value === '25_PLUS') {
    return `${ageLabel} (${seasonReferenceYear - 25 + 1}년생 이하)`;
  }

  return `${ageLabel} (${seasonReferenceYear - Number(value) + 1}년생)`;
}

function createManifest(
  scope: RoommateSearchScope,
  purpose: RoommateSearchPurpose,
  seasonContext: SeasonContextValue = createSeasonContext('SEASON_MATCHING'),
): RoommateSearchManifest {
  const filtersEnabled =
    scope === 'SAME_BUILDING_ONLY' && purpose === 'ACTIONABLE_DETAIL_DISCOVERY';
  const disabledReason = filtersEnabled
    ? undefined
    : '현재 탐색 범위에서는 상세 필터를 열지 않아요.';

  return {
    manifestRevision: `story-${scope.toLowerCase()}-${purpose.toLowerCase()}-r1`,
    scope,
    purpose,
    filters: {
      enabled: filtersEnabled,
      fields: {
        smokingBehavior: lifestyleField(filtersEnabled, disabledReason, [
          ['NO', '비흡연'],
          ['E_CIG', '전자담배'],
          ['YES', '흡연'],
        ]),
        bedtime: lifestyleField(filtersEnabled, disabledReason, [
          ['BEFORE_22', '22시 이전'],
          ['22_24', '22~24시'],
          ['24_02', '24~02시'],
          ['AFTER_02', '02시 이후'],
        ]),
        wakeTime: lifestyleField(filtersEnabled, disabledReason, [
          ['BEFORE_07', '07시 이전'],
          ['07_08', '07~08시'],
          ['08_09', '08~09시'],
          ['09_10', '09~10시'],
          ['AFTER_10', '10시 이후'],
          ['FLEXIBLE', '유동적'],
        ]),
        noiseSensitivity: lifestyleField(filtersEnabled, disabledReason, [
          ['SENSITIVE', '민감'],
          ['NORMAL', '보통'],
          ['DEEP', '둔감'],
        ]),
        cleanLevel: lifestyleField(filtersEnabled, disabledReason, [
          ['WHEN_DIRTY', '더러울 때'],
          ['WEEKLY_1_2', '주 1~2회'],
          ['WEEKLY_3_UP', '주 3회 이상'],
        ]),
        sleepHabit: lifestyleField(filtersEnabled, disabledReason, [
          ['NONE', '없음'],
          ['TALKING', '잠꼬대'],
          ['SNORING', '코골이'],
          ['GRINDING', '이갈이'],
          ['HAS', '있음'],
        ]),
        indoorEating: lifestyleField(filtersEnabled, disabledReason, [
          ['RARELY', '거의 안 함'],
          ['SNACK', '간식'],
          ['MEAL', '식사'],
        ]),
        relationshipStyle: lifestyleField(filtersEnabled, disabledReason, [
          ['CLOSE', '가까운 관계'],
          ['CASUAL', '적당한 거리'],
        ]),
        college: {
          enabled: filtersEnabled,
          source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
          operators: ['INCLUDE', 'EXCLUDE'],
          options: CHUNCHEON_COLLEGE_CATALOG.map((college) => ({
            code: college.code,
            label: college.nameKo,
          })),
          ...(disabledReason ? { disabledReason } : {}),
        },
        grade: {
          enabled: filtersEnabled,
          source: 'PROFILE_ENUM',
          operators: ['INCLUDE'],
          options: [
            { code: '1', label: '1학년' },
            { code: '2', label: '2학년' },
            { code: '3', label: '3학년' },
            { code: '4+', label: '4학년 이상' },
          ],
          ...(disabledReason ? { disabledReason } : {}),
        },
        mbtiTraits: {
          enabled: filtersEnabled,
          source: 'MBTI_TRAITS',
          options: [
            { code: 'E', label: 'E' },
            { code: 'I', label: 'I' },
            { code: 'N', label: 'N' },
            { code: 'S', label: 'S' },
            { code: 'T', label: 'T' },
            { code: 'F', label: 'F' },
            { code: 'J', label: 'J' },
            { code: 'P', label: 'P' },
          ],
          ...(disabledReason ? { disabledReason } : {}),
        },
        ageBand: {
          enabled: filtersEnabled,
          source: 'AGE_BAND',
          options: createRoommateStoryAgeBandOptions(seasonContext),
          ...(disabledReason ? { disabledReason } : {}),
        },
        minScore: {
          enabled: filtersEnabled,
          source: 'MATCH_SCORE_PRESET',
          options: ROOMMATE_SEARCH_MIN_SCORE_PRESETS.map((value) => ({
            code: String(value),
            label: `${value}점 이상`,
          })),
          ...(disabledReason ? { disabledReason } : {}),
        },
      },
    },
    sorts: {
      default: filtersEnabled ? 'MATCH_SCORE' : 'NICKNAME',
      options: filtersEnabled ? ['MATCH_SCORE', 'NICKNAME'] : ['NICKNAME'],
    },
  };
}

function lifestyleField(
  enabled: boolean,
  disabledReason: string | undefined,
  options: readonly (readonly [string, string])[],
): RoommateSearchManifest['filters']['fields'][string] {
  return {
    enabled,
    source: 'LIFESTYLE_FIELD_OPTIONS',
    options: options.map(([code, label]) => ({ code, label })),
    ...(disabledReason ? { disabledReason } : {}),
  };
}

const DEFAULT_SCOPE_AVAILABILITY: RoommateSearchResponse['scopeAvailability'] = {
  campusMerged: true,
  sameBuildingOnly: true,
};

function createManifestResponse(
  scope: RoommateSearchScope,
  purpose: RoommateSearchPurpose,
  notices: readonly RoommateSearchAvailabilityNotice[] = [],
  scopeAvailability: RoommateSearchResponse['scopeAvailability'] = DEFAULT_SCOPE_AVAILABILITY,
  seasonContext: SeasonContextValue = createSeasonContext('SEASON_MATCHING'),
): RoommateSearchManifestResponse {
  return {
    scope,
    scopeAvailability,
    manifest: createManifest(scope, purpose, seasonContext),
    availabilityNotices: [...notices],
  };
}

function createSearchResponse(input: {
  scope: RoommateSearchScope;
  purpose: RoommateSearchPurpose;
  items: readonly RoommateSearchSummary[];
  notices?: readonly RoommateSearchAvailabilityNotice[];
  scopeAvailability?: RoommateSearchResponse['scopeAvailability'];
  seasonContext?: SeasonContextValue;
}): RoommateSearchResponse {
  return {
    scope: input.scope,
    appliedSort:
      input.scope === 'SAME_BUILDING_ONLY' && input.purpose === 'ACTIONABLE_DETAIL_DISCOVERY'
        ? 'MATCH_SCORE'
        : 'NICKNAME',
    resultSummary: createSearchResultSummary(input.items),
    scopeAvailability: input.scopeAvailability ?? DEFAULT_SCOPE_AVAILABILITY,
    manifest: createManifest(input.scope, input.purpose, input.seasonContext),
    pageInfo: { hasNextPage: false, nextCursor: null },
    availabilityNotices: [...(input.notices ?? [])],
    items: [...input.items],
  };
}

function createSearchResultSummary(
  items: readonly RoommateSearchSummary[],
): RoommateSearchResponse['resultSummary'] {
  const detailViewableCount = items.filter((item) => item.exposure.detailViewable).length;
  const scoreVisibleCount = items.filter((item) => item.exposure.scoreVisible).length;

  return {
    summaryOnlyCount: items.length - detailViewableCount,
    detailViewableCount,
    scoreVisibleCount,
  };
}

function createSummary(input: {
  id: string;
  nickname: string;
  intro: string;
  exposure: PublicTargetExposure;
  actions: PublicProfileActionCapabilities;
  relation?: PublicTargetRelation;
  resultRead?: PublicTargetResultRead;
  matchScore?: number;
  bookmarked?: boolean;
  detailContext?: string;
  smokingBehavior?: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  sleepHabit?: RoommateSearchSummary['profileSummary']['sleepHabit'];
  relationshipStyle?: RoommateSearchSummary['profileSummary']['relationshipStyle'];
}): RoommateSearchSummary {
  return {
    id: input.id,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: input.relation ?? GENERAL_RELATION,
    exposure: input.exposure,
    actions: input.actions,
    resultRead: input.resultRead ?? NO_RESULT_READ,
    profileSummary: {
      nickname: input.nickname,
      intro: input.intro,
      smokingBehavior: input.smokingBehavior ?? 'NO',
      sleepHabit: input.sleepHabit ?? 'NONE',
      relationshipStyle: input.relationshipStyle ?? 'CASUAL',
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
    bookmark: input.bookmarked
      ? { bookmarked: true, bookmarkedAt: ISO_NOW }
      : { bookmarked: false },
    ...(input.detailContext ? { detailEntryToken: input.detailContext } : {}),
  };
}

type StorySummaryFactCombination = {
  readonly smokingBehavior: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  readonly sleepHabit: RoommateSearchSummary['profileSummary']['sleepHabit'];
  readonly relationshipStyle: RoommateSearchSummary['profileSummary']['relationshipStyle'];
};

const jiwooSummary = createSummary({
  id: TARGET_JIWOO,
  nickname: '지우',
  intro: '아침형이고 조용한 방 분위기를 좋아해요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 92,
  detailContext: 'story-detail-context-jiwoo',
});
const scoreCalculationFailedSummary = createSummary({
  id: TARGET_JIWOO,
  nickname: '지우',
  intro: '아침형이고 조용한 방 분위기를 좋아해요.',
  exposure: { ...FULL_EXPOSURE, scoreVisible: false },
  actions: ACTIONABLE_ACTIONS,
  detailContext: 'story-detail-context-jiwoo-score-unavailable',
});
const hayoonSummary = createSummary({
  id: TARGET_HAYOON,
  nickname: '하윤',
  intro: '청소 주기를 미리 맞춰두는 편이에요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 85,
  bookmarked: true,
  detailContext: 'story-detail-context-hayoon',
  sleepHabit: 'TALKING',
});
const campusPreviewSummary = createSummary({
  id: TARGET_CAMPUS,
  nickname: '캠퍼스 미리보기',
  intro: '다른 건물 후보는 요약 정보만 확인할 수 있어요.',
  exposure: SUMMARY_ONLY_EXPOSURE,
  actions: SUMMARY_ONLY_ACTIONS,
  smokingBehavior: null,
  sleepHabit: null,
});
const postMatchSummary = createSummary({
  id: TARGET_POST,
  nickname: '현재 매칭 상대',
  intro: '매칭 결과 맥락으로 읽기만 가능한 상태예요.',
  exposure: FULL_EXPOSURE,
  actions: POST_MATCH_ACTIONS,
  relation: MATCHED_RELATION,
  resultRead: RESULT_READ,
  matchScore: 88,
  detailContext: 'story-detail-context-post-match',
});
const tombstoneSummary = createSummary({
  id: TARGET_TOMBSTONE,
  nickname: '하린',
  intro: '상세를 여는 사이 시즌 참여 상태가 바뀔 수 있어요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 91,
  detailContext: 'story-detail-context-tombstone',
});
const errorSummary = createSummary({
  id: TARGET_ERROR,
  nickname: '민서',
  intro: '상세 요청이 서버에서 다시 확인되는 예시예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 86,
  detailContext: 'story-detail-context-hidden',
});

const SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES = [
  ['operated-female', '테스트춘천여'],
  ['home-e2e-open', '오픈시즌홈'],
  ['home-e2e-postmatch', '마감시즌홈'],
  ['home-e2e-yeji-01', '예지홈01'],
  ['home-e2e-yeji-02', '예지홈02'],
  ['home-e2e-yeji-03', '예지홈03'],
  ['home-e2e-yeji-04', '예지홈04'],
  ['home-e2e-yeji-05', '예지홈05'],
  ['home-e2e-yeji-06', '예지홈06'],
  ['home-e2e-yeji-07', '예지홈07'],
  ['home-e2e-yeji-08', '예지홈08'],
  ['home-e2e-yeji-09', '예지홈09'],
  ['home-e2e-yeji-10', '예지홈10'],
  ['home-e2e-saerom-02', '새롬홈02'],
  ['home-e2e-saerom-04', '새롬홈04'],
  ['home-e2e-saerom-06', '새롬홈06'],
  ['home-e2e-saerom-08', '새롬홈08'],
  ['home-e2e-saerom-10', '새롬홈10'],
  ['home-e2e-irum-02', '이룸홈02'],
  ['home-e2e-irum-04', '이룸홈04'],
  ['home-e2e-irum-06', '이룸홈06'],
  ['home-e2e-irum-08', '이룸홈08'],
  ['home-e2e-daon-02', '다온홈02'],
  ['home-e2e-daon-04', '다온홈04'],
] as const;

const SEASON_OPEN_SAME_DORMITORY_BE_FIXTURE_CANDIDATES =
  SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES.filter(
    ([fixtureKey]) =>
      fixtureKey.includes('yeji') ||
      fixtureKey === 'operated-female' ||
      fixtureKey === 'home-e2e-open',
  );

const SEASON_OPEN_SUMMARY_FACT_COMBINATIONS = [
  { smokingBehavior: 'NO', sleepHabit: 'NONE', relationshipStyle: 'CASUAL' },
  { smokingBehavior: 'YES', sleepHabit: 'TALKING', relationshipStyle: 'CLOSE' },
  { smokingBehavior: 'E_CIG', sleepHabit: 'SNORING', relationshipStyle: 'CASUAL' },
  { smokingBehavior: 'NO', sleepHabit: 'GRINDING', relationshipStyle: 'CLOSE' },
] as const satisfies readonly StorySummaryFactCombination[];

const SEASON_OPEN_SAME_DORMITORY_STORY_NICKNAMES = [
  '가온',
  '나래',
  '다솜',
  '라희',
  '민재',
  '서윤',
  '아린',
  '유진',
  '지우',
  '하람',
  '해솔',
  '희원',
] as const;

const SEASON_OPEN_SAME_DORMITORY_STORY_SCORES = [
  96, 85, 88, 50, 84, 35, 91, 70, 58, 77, 54, 43,
] as const;

const seasonOpenCampusPreviewSummaries = SEASON_OPEN_CAMPUS_BE_FIXTURE_CANDIDATES.map(
  ([fixtureKey, nickname], index) => {
    const factCombination =
      SEASON_OPEN_SUMMARY_FACT_COMBINATIONS[index % SEASON_OPEN_SUMMARY_FACT_COMBINATIONS.length]!;

    return createSummary({
      id: `story-roommate-${fixtureKey}`,
      nickname,
      intro:
        index % 2 === 0
          ? `${nickname}님의 공개 요약을 먼저 확인해 보세요. 같은 건물 후보가 아니면 상세 비교는 열리지 않아요.`
          : `${nickname}님은 시즌 등록을 마친 공개 후보예요. 생활패턴 상세는 정책에 맞는 범위에서만 볼 수 있어요.`,
      exposure: SUMMARY_ONLY_EXPOSURE,
      actions: SUMMARY_ONLY_ACTIONS,
      smokingBehavior: factCombination.smokingBehavior,
      sleepHabit: factCombination.sleepHabit,
      relationshipStyle: factCombination.relationshipStyle,
    });
  },
);

const seasonOpenSameDormitorySummaries = SEASON_OPEN_SAME_DORMITORY_BE_FIXTURE_CANDIDATES.map(
  ([fixtureKey, fallbackNickname], index) => {
    const factCombination =
      SEASON_OPEN_SUMMARY_FACT_COMBINATIONS[
        (index + 1) % SEASON_OPEN_SUMMARY_FACT_COMBINATIONS.length
      ]!;
    const nickname = SEASON_OPEN_SAME_DORMITORY_STORY_NICKNAMES[index] ?? fallbackNickname;
    const matchScore = SEASON_OPEN_SAME_DORMITORY_STORY_SCORES[index] ?? Math.max(30, 96 - index);

    return createSummary({
      id: `story-roommate-${fixtureKey}`,
      nickname,
      intro:
        index % 2 === 0
          ? `${nickname}님과 생활패턴과 원하는 조건을 자세히 비교할 수 있어요.`
          : `${nickname}님과 먼저 대화해 보고, 관심 목록에 저장해 다시 확인할 수 있어요.`,
      exposure: FULL_EXPOSURE,
      actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
      matchScore,
      bookmarked: index === 1,
      detailContext: `story-detail-context-${fixtureKey}`,
      smokingBehavior: factCombination.smokingBehavior,
      sleepHabit: factCombination.sleepHabit,
      relationshipStyle: factCombination.relationshipStyle,
    });
  },
);

const seasonMatchingSameDormitorySummaries = seasonOpenSameDormitorySummaries.map(
  (summary, index) => ({
    ...summary,
    actions: ACTIONABLE_ACTIONS,
    profileSummary: {
      ...summary.profileSummary,
      intro:
        index % 2 === 0
          ? `${summary.profileSummary.nickname}님은 지금 매칭 요청과 대화가 가능한 같은 건물 후보예요.`
          : `${summary.profileSummary.nickname}님과 생활패턴을 비교하고, 매칭 요청을 보낼 수 있어요.`,
    },
  }),
);

function createPublicProfileFull(input: {
  id: string;
  nickname: string;
  intro: string;
  matchScore?: number;
  scoreVisible?: boolean;
  actions?: PublicProfileActionCapabilities;
  relation?: PublicTargetRelation;
  resultRead?: PublicTargetResultRead;
}): PublicProfileFullDetail {
  const scoreVisible = input.scoreVisible ?? typeof input.matchScore === 'number';
  return {
    id: input.id,
    detailState: 'FULL',
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: input.relation ?? GENERAL_RELATION,
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible,
    },
    actions: input.actions ?? ACTIONABLE_ACTIONS,
    resultRead: input.resultRead ?? NO_RESULT_READ,
    nickname: input.nickname,
    intro: input.intro,
    additional: {
      college: 'IT',
      grade: '3',
      mbti: 'INFJ',
      birthYear: 2002,
    },
    gender: 'F',
    campus: 'CHUNCHEON',
    lifestyle: {
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      noiseSensitivity: 'SENSITIVE',
      smokingBehavior: 'NO',
      indoorEating: 'SNACK',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WEEKLY_3_UP',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
    ...(scoreVisible && typeof input.matchScore === 'number'
      ? {
          compatibility: {
            overallScore: input.matchScore,
            axes: [
              { id: 'SLEEP_HABIT', score: 95, bucket: 'HIGH' },
              { id: 'PHONE', score: 86, bucket: 'HIGH' },
              { id: 'CLEAN_LEVEL', score: 78, bucket: 'MEDIUM' },
              { id: 'RELATIONSHIP', score: 82, bucket: 'HIGH' },
            ],
            hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
          },
        }
      : {}),
  };
}

function createPublicProfileTombstone(input: {
  id: string;
  displayName: string;
  message: string;
}): PublicProfileTombstone {
  return {
    id: input.id,
    detailState: 'TOMBSTONE',
    relation: GENERAL_RELATION,
    exposure: TOMBSTONE_EXPOSURE,
    actions: TOMBSTONE_ACTIONS,
    resultRead: NO_RESULT_READ,
    tombstone: {
      reason: 'TARGET_NO_LONGER_DISCOVERABLE',
      displayName: input.displayName,
      message: input.message,
    },
  };
}

const defaultProfiles: Readonly<Record<string, PublicProfile>> = {
  [TARGET_JIWOO]: createPublicProfileFull({
    id: TARGET_JIWOO,
    nickname: '지우',
    intro: '아침형이고 조용한 방 분위기를 좋아해요.',
    matchScore: 92,
  }),
  [TARGET_HAYOON]: createPublicProfileFull({
    id: TARGET_HAYOON,
    nickname: '하윤',
    intro: '청소 주기를 미리 맞춰두는 편이에요.',
    matchScore: 85,
  }),
  [TARGET_POST]: createPublicProfileFull({
    id: TARGET_POST,
    nickname: '현재 매칭 상대',
    intro: '매칭 결과 맥락으로 읽기만 가능한 상태예요.',
    matchScore: 88,
    actions: POST_MATCH_ACTIONS,
    relation: MATCHED_RELATION,
    resultRead: RESULT_READ,
  }),
  [TARGET_TOMBSTONE]: createPublicProfileTombstone({
    id: TARGET_TOMBSTONE,
    displayName: '하린',
    message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
  }),
};

const seasonOpenProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    seasonOpenSameDormitorySummaries.map((summary) => [
      summary.id,
      createPublicProfileFull({
        id: summary.id,
        nickname: summary.profileSummary.nickname,
        intro: summary.profileSummary.intro ?? '같은 건물 후보 상세 정보예요.',
        matchScore: summary.matchScore,
        actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
      }),
    ]),
  ),
};

const seasonMatchingProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    seasonMatchingSameDormitorySummaries.map((summary) => [
      summary.id,
      createPublicProfileFull({
        id: summary.id,
        nickname: summary.profileSummary.nickname,
        intro: summary.profileSummary.intro ?? '매칭 기간 같은 건물 후보 상세 정보예요.',
        matchScore: summary.matchScore,
        actions: ACTIONABLE_ACTIONS,
      }),
    ]),
  ),
};

const bookmarksEmpty: BookmarkListResponse = {
  sort: 'RECENT',
  items: [],
  pageInfo: { hasNextPage: false, nextCursor: null },
  emptyState: { code: 'NO_BOOKMARKS' },
  serverTime: ISO_NOW,
};

function createMatchRequestActionResponse(): MatchRequestActionResponse {
  const request: MatchRequestSummary = {
    id: 'story-match-request-1',
    seasonId: 'season-2026-02',
    direction: 'SENT',
    counterpartUserId: TARGET_JIWOO,
    counterpartParticipantId: `participant-${TARGET_JIWOO}`,
    counterpartSummary: jiwooSummary,
    status: 'PENDING',
    note: null,
    createdAt: ISO_NOW,
    expiresAt: '2026-07-13T03:00:00.000Z',
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
  };
  return { request, activeMatch: null };
}

function createBlockResponse(targetUserId: string): CreateBlockResponse {
  return {
    block: {
      id: `story-block-${targetUserId}`,
      blockedUserId: targetUserId,
      blockedAt: ISO_NOW,
      note: null,
    },
    created: true,
    listMetadata: { serverTime: ISO_NOW },
  };
}

function createReportResponse(optionalBlock: boolean): CreateReportResponse {
  return {
    report: {
      id: 'story-report-1',
      targetType: 'PROFILE',
      reason: 'FALSE_PROFILE',
      receivedAt: ISO_NOW,
      status: 'RECEIVED',
    },
    received: true,
    optionalActionResult: optionalBlock
      ? { action: 'BLOCK_TARGET', status: 'SUCCEEDED', code: null }
      : null,
  };
}

const SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY = {
  campusMerged: false,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

const SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: false,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

const actionableSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [jiwooSummary, hayoonSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const scoreCalculationFailedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [scoreCalculationFailedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const seasonMatchingRegisteredSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: seasonMatchingSameDormitorySummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const seasonMatchingNotRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});

const seasonMatchingNotRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});

const seasonMatchingRegisteredEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'FILTER_RESULT_EMPTY', severity: 'INFO' }],
  items: [],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const campusMergedForUnregistered = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE', severity: 'INFO' }],
  items: [campusPreviewSummary],
  scopeAvailability: { campusMerged: true, sameBuildingOnly: false },
});
const seasonOpenRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
});
const seasonOpenRegisteredSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: seasonOpenSameDormitorySummaries,
});
const seasonOpenRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
});
const seasonOpenRegisteredSameDormitoryEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [],
});
const seasonOpenNotRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
});
const seasonOpenNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [],
});
const seasonOpenRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenRegisteredSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const seasonOpenRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonOpenRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonOpenRegisteredSameDormitoryEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const seasonOpenNotRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenNotRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const postMatch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [postMatchSummary],
});
const tombstoneSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DETAIL_UNAVAILABLE_BY_POLICY', severity: 'WARNING' }],
  items: [tombstoneSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const errorDetailSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [errorSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

function withSeasonBoundSearchManifest(
  response: RoommateSearchResponse,
  seasonContext: SeasonContextValue,
): RoommateSearchResponse {
  return {
    ...response,
    manifest: createManifest(response.scope, response.manifest.purpose, seasonContext),
  };
}

function withSeasonBoundManifestResponse(
  response: RoommateSearchManifestResponse,
  seasonContext: SeasonContextValue,
): RoommateSearchManifestResponse {
  return {
    ...response,
    manifest: createManifest(response.scope, response.manifest.purpose, seasonContext),
  };
}

function withSeasonBoundScopeResponses(
  responses: Partial<Record<RoommateSearchScope, RoommateSearchResponse>> | undefined,
  seasonContext: SeasonContextValue,
): Partial<Record<RoommateSearchScope, RoommateSearchResponse>> | undefined {
  if (!responses) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(responses).map(([scope, response]) => [
      scope,
      withSeasonBoundSearchManifest(response, seasonContext),
    ]),
  ) as Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
}

function baseScenario(input: {
  key: RoommateStoryScenarioKey;
  title: string;
  description: string;
  category: RoommateStoryCategory;
  seasonGroup?: RoommateStorySeasonGroup;
  viewportHint?: RoommateStoryViewportHint;
  autoOpen?: RoommateStoryAutoOpen;
  searchEntryAllowed?: boolean;
  searchResponse?: RoommateSearchResponse;
  searchResponsesByScope?: Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
  manifestResponse?: RoommateSearchManifestResponse;
  bookmarkResponse?: BookmarkListResponse;
  profileByTargetUserId?: Readonly<Record<string, PublicProfile>>;
  profileErrorByTargetUserId?: Readonly<Record<string, { code: string; status: number }>>;
  matchRequestError?: { code: string; status: number };
  responseDelayMs?: number;
  blockResponse?: CreateBlockResponse;
  reportResponse?: CreateReportResponse;
  searchErrorCode?: string;
  searchErrorStatus?: number;
  searchResponseDelayMs?: number;
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
    searchResponse,
    ...(searchResponsesByScope ? { searchResponsesByScope } : {}),
    ...(manifestResponse ? { manifestResponse } : {}),
    ...(input.searchErrorCode ? { searchErrorCode: input.searchErrorCode } : {}),
    ...(input.searchErrorStatus ? { searchErrorStatus: input.searchErrorStatus } : {}),
    ...(typeof input.searchResponseDelayMs === 'number'
      ? { searchResponseDelayMs: input.searchResponseDelayMs }
      : {}),
    bookmarkResponse: input.bookmarkResponse ?? bookmarksEmpty,
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
    reportResponse: input.reportResponse ?? createReportResponse(false),
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
      '느린 네트워크에서 같은 건물 후보 목록과 우측 검색·필터 패널이 도착하기 전 스켈레톤을 보여주는 상태입니다.',
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
    title: 'Season Matching + Registered / actionable same-building candidates',
    description:
      '매칭 기간 등록 완료 사용자는 같은 건물 후보만 탐색하며 상세 비교, 관심 저장, 매칭 요청, 대화 가능 상태를 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingNotRegistered: baseScenario({
    key: 'seasonMatchingNotRegistered',
    title: 'Season Matching + Not Registered / campus summary preview',
    description:
      '매칭 기간 등록 전 사용자는 캠퍼스 공개 요약만 둘러볼 수 있고 같은 건물 actionable 후보와 상세/점수/action은 열리지 않습니다.',
    category: 'search',
    searchResponse: seasonMatchingNotRegisteredCampusMerged,
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
    viewer: { ...storyViewer, dormitoryId: null },
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingRegisteredEmpty: baseScenario({
    key: 'seasonMatchingRegisteredEmpty',
    title: 'Season Matching + Registered + candidate 0',
    description:
      '매칭 기간 등록 완료 사용자의 같은 건물 actionable scope에 조건에 맞는 신규 후보가 없을 때 empty 안내를 확인합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredEmpty,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
  }),
  seasonMatchingSearchError: baseScenario({
    key: 'seasonMatchingSearchError',
    title: 'Season Matching / retry-safe search error',
    description:
      '매칭 기간 search BFF 실패 시 등록 상태와 무관하게 raw upstream detail 없이 사용자 재시도 안내만 노출합니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
    searchErrorCode: 'BFF_UPSTREAM_UNAVAILABLE',
    searchErrorStatus: 503,
  }),
  seasonMatchingLoadingSkeleton: baseScenario({
    key: 'seasonMatchingLoadingSkeleton',
    title: 'Season Matching + Loading Skeleton',
    description:
      '매칭 기간 같은 건물 actionable 후보 목록과 검색·필터 패널이 도착하기 전 스켈레톤을 보여주는 상태입니다.',
    category: 'search',
    searchResponse: seasonMatchingRegisteredSameDormitory,
    profileByTargetUserId: seasonMatchingProfileByTargetUserId,
    searchResponseDelayMs: 20_000,
  }),
  seasonMatchingDetailFullCompatibility: baseScenario({
    key: 'seasonMatchingDetailFullCompatibility',
    title: 'Season Matching + Registered / detail full compatibility',
    description:
      '매칭 기간 같은 건물 actionable 후보의 FULL detail, 매칭점수 radar, axis list, privacy notice가 함께 보이는 상태입니다.',
    category: 'detail',
    autoOpen: 'detail',
    searchResponse: actionableSearch,
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
    title: 'Season Matching + Registered / match request dialog',
    description:
      '매칭 기간 같은 건물 actionable 후보 상세에서 매칭 요청 confirmation dialog와 optional note 제한 copy를 확인합니다.',
    category: 'action',
    autoOpen: 'match-request-dialog',
  }),
  seasonMatchingMatchRequestStaleError: baseScenario({
    key: 'seasonMatchingMatchRequestStaleError',
    title: 'Season Matching + Registered / match request stale feedback',
    description:
      '매칭 요청 전송 시점 재검증에서 거절된 경우 safe stale feedback과 refresh path를 확인합니다.',
    category: 'action',
    autoOpen: 'match-request-stale-submit',
    matchRequestError: { code: 'MATCH_REQUEST_NOT_ALLOWED', status: 409 },
  }),
  seasonMatchingBlockDialog: baseScenario({
    key: 'seasonMatchingBlockDialog',
    title: 'Season Matching + Registered / block dialog',
    description:
      '매칭 기간 같은 건물 후보 상세에서 차단 확인 dialog와 optional memo copy를 확인합니다.',
    category: 'action',
    autoOpen: 'block-dialog',
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
  seasonMatchingReportOptionalBlockReceipt: baseScenario({
    key: 'seasonMatchingReportOptionalBlockReceipt',
    title: 'Season Matching + Registered / report with optional block receipt',
    description: '매칭 기간 신고 접수와 선택 차단 성공 후 intake-only receipt copy를 확인합니다.',
    category: 'action',
    autoOpen: 'report-optional-block-submit',
    viewportHint: 'long-content',
    reportResponse: createReportResponse(true),
  }),
  seasonMatchingMobileBookmarkIconState: baseScenario({
    key: 'seasonMatchingMobileBookmarkIconState',
    title: 'Season Matching + Registered / mobile bookmark icon affordance',
    description:
      '매칭 기간 같은 건물 후보 모바일 카드 상단에서 bookmark icon만으로 저장/해제 용도를 드러내는 상태입니다.',
    category: 'responsive',
    viewportHint: 'mobile',
    searchResponse: createSearchResponse({
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
      notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
      items: [hayoonSummary, jiwooSummary],
    }),
  }),
  seasonMatchingActionPendingDisabled: baseScenario({
    key: 'seasonMatchingActionPendingDisabled',
    title: 'Season Matching + Registered / pending duplicate submit guard',
    description:
      '매칭 기간 매칭 요청 전송 중 duplicate submit을 막는 버튼 pending label을 빠르게 확인하는 상태입니다.',
    category: 'action',
    autoOpen: 'match-request-stale-submit',
    responseDelayMs: 20_000,
  }),
  postMatchCohortReview: baseScenario({
    key: 'postMatchCohortReview',
    title: 'Post Match / cohort review action closed',
    description:
      '시즌 종료 후 cohort review에서는 result-read 맥락만 유지하고 새 요청 action은 닫힙니다.',
    category: 'search',
    seasonGroup: 'postMatch',
    searchResponse: postMatch,
    seasonContext: createSeasonContext('SEASON_POST_MATCH'),
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
