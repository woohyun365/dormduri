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
import {
  buildPublicProfileCompatibility,
  calcViewerMatchScore,
} from '@repo/shared/profile/compatibility-scoring';
import type {
  PublicProfile,
  PublicProfileActionCapabilities,
  PublicProfileCompatibility,
  PublicProfileCompatibilityAxis,
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityBucket,
  PublicProfileCompatibilityDimension,
  PublicProfileFullDetail,
  PublicProfileTombstone,
  PublicTargetExposure,
  PublicTargetRelation,
  PublicTargetResultRead,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { BookmarkListResponse } from '@repo/shared/social-safety/bookmark';
import type { CreateBlockResponse } from '@repo/shared/social-safety/block';
import type { CreateReportResponse } from '@repo/shared/social-safety/report';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';

const ROOMMATE_STORY_AGE_BAND_CODES = ['20', '21', '22', '23', '24', '25_PLUS'] as const;

export type RoommateStoryCategory = 'search' | 'detail' | 'action';
export type RoommateStorySeasonGroup = 'offSeason' | 'seasonOpen' | 'seasonMatching' | 'postMatch';
export type RoommateStoryAutoOpen =
  | 'bookmark-toggle'
  | 'filter-sheet'
  | 'detail'
  | 'match-request-dialog'
  | 'match-request-submit'
  | 'block-dialog'
  | 'block-submit'
  | 'report-dialog'
  | 'report-submit'
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
  readonly searchClosedMessage?: string;
  readonly sameDormitoryRestrictedEmptyState?: {
    readonly title: string;
    readonly message: string;
  };
  readonly viewer: UserProfile;
  readonly seasonContext: SeasonContextValue;
  readonly searchResponse: RoommateSearchResponse;
  readonly searchResponsesByScope?: Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
  readonly manifestResponse?: RoommateSearchManifestResponse;
  readonly searchErrorCode?: string;
  readonly searchErrorStatus?: number;
  readonly searchResponseDelayMs?: number;
  readonly profileResponseDelayMs?: number;
  readonly bookmarkResponse: BookmarkListResponse;
  readonly bookmarkError?: { code: string; status: number };
  readonly profileByTargetUserId: Readonly<Record<string, PublicProfile>>;
  readonly profileErrorByTargetUserId?: Readonly<Record<string, { code: string; status: number }>>;
  readonly matchRequestResponse: MatchRequestActionResponse;
  readonly matchRequestError?: { code: string; status: number };
  readonly responseDelayMs?: number;
  readonly blockResponse: CreateBlockResponse;
  readonly blockError?: { code: string; status: number };
  readonly reportResponse: CreateReportResponse;
  readonly reportError?: { code: string; status: number };
}

export const ROOMMATE_STORY_SCENARIO_KEYS = [
  'offSeasonClosed',
  'seasonOpenRegistered',
  'seasonOpenRegisteredChatting',
  'seasonOpenNotRegistered',
  'seasonOpenDeregistered',
  'seasonOpenRegisteredEmpty',
  'seasonOpenSearchError',
  'seasonOpenLoadingSkeleton',
  'seasonMatchingRegistered',
  'seasonMatchingRegisteredChatting',
  'seasonMatchingActiveMatched',
  'seasonMatchingUnmatched',
  'seasonMatchingDeregistered',
  'seasonMatchingNotRegistered',
  'seasonMatchingNotRegisteredEmpty',
  'seasonMatchingRegisteredEmpty',
  'seasonMatchingSearchError',
  'seasonMatchingLoadingSkeleton',
  'seasonMatchingDetailFullCompatibility',
  'seasonMatchingDetailPending',
  'seasonMatchingDetailEmptyIntro',
  'seasonMatchingExceptionScoreCalculationFailed',
  'seasonMatchingExceptionDetailFetchFailed',
  'seasonMatchingExceptionDetailUnavailable',
  'seasonMatchingExceptionAccessRecheckFailed',
  'seasonMatchingMatchRequestDialog',
  'seasonMatchingMatchRequestPending',
  'seasonMatchingMatchRequestSuccess',
  'seasonMatchingPendingRequests',
  'seasonMatchingMatchRequestFailed',
  'seasonMatchingMatchRequestAlreadyPending',
  'seasonMatchingMatchRequestLimitReached',
  'seasonMatchingMatchRequestTargetMatched',
  'seasonMatchingMatchRequestTargetDeregistered',
  'seasonMatchingBookmarkStaleFailure',
  'seasonMatchingActionBlockedUser',
  'seasonMatchingBlockDialog',
  'seasonMatchingBlockPending',
  'seasonMatchingBlockFailed',
  'seasonMatchingBlockSuccessReceipt',
  'seasonMatchingReportDialog',
  'seasonMatchingReportPending',
  'seasonMatchingReportFailed',
  'seasonMatchingReportSuccessReceipt',
  'seasonMatchingReportOptionalBlockReceipt',
  'postMatchRegistered',
  'postMatchNotRegistered',
  'postMatchDeregistered',
  'postMatchEmpty',
  'postMatchSearchError',
  'postMatchLoadingSkeleton',
] as const;

export type RoommateStoryScenarioKey = (typeof ROOMMATE_STORY_SCENARIO_KEYS)[number];

export const ROOMMATE_STORY_CATEGORY_KEYS = {
  search: [
    'offSeasonClosed',
    'seasonOpenRegistered',
    'seasonOpenRegisteredChatting',
    'seasonOpenNotRegistered',
    'seasonOpenDeregistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
    'seasonMatchingRegistered',
    'seasonMatchingRegisteredChatting',
    'seasonMatchingActiveMatched',
    'seasonMatchingUnmatched',
    'seasonMatchingDeregistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'postMatchRegistered',
    'postMatchNotRegistered',
    'postMatchDeregistered',
    'postMatchEmpty',
    'postMatchSearchError',
    'postMatchLoadingSkeleton',
  ],
  detail: [
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingDetailPending',
    'seasonMatchingDetailEmptyIntro',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailFetchFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
  ],
  action: [
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestPending',
    'seasonMatchingMatchRequestSuccess',
    'seasonMatchingPendingRequests',
    'seasonMatchingMatchRequestFailed',
    'seasonMatchingMatchRequestAlreadyPending',
    'seasonMatchingMatchRequestLimitReached',
    'seasonMatchingMatchRequestTargetMatched',
    'seasonMatchingMatchRequestTargetDeregistered',
    'seasonMatchingBookmarkStaleFailure',
    'seasonMatchingActionBlockedUser',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockPending',
    'seasonMatchingBlockFailed',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportPending',
    'seasonMatchingReportFailed',
    'seasonMatchingReportSuccessReceipt',
    'seasonMatchingReportOptionalBlockReceipt',
  ],
} as const satisfies Record<RoommateStoryCategory, readonly RoommateStoryScenarioKey[]>;

export const ROOMMATE_STORY_SEASON_GROUP_KEYS = {
  offSeason: ['offSeasonClosed'],
  seasonOpen: [
    'seasonOpenRegistered',
    'seasonOpenRegisteredChatting',
    'seasonOpenNotRegistered',
    'seasonOpenDeregistered',
    'seasonOpenRegisteredEmpty',
    'seasonOpenSearchError',
    'seasonOpenLoadingSkeleton',
  ],
  seasonMatching: [
    'seasonMatchingRegistered',
    'seasonMatchingRegisteredChatting',
    'seasonMatchingActiveMatched',
    'seasonMatchingUnmatched',
    'seasonMatchingDeregistered',
    'seasonMatchingNotRegistered',
    'seasonMatchingNotRegisteredEmpty',
    'seasonMatchingRegisteredEmpty',
    'seasonMatchingSearchError',
    'seasonMatchingLoadingSkeleton',
    'seasonMatchingDetailFullCompatibility',
    'seasonMatchingDetailPending',
    'seasonMatchingDetailEmptyIntro',
    'seasonMatchingExceptionScoreCalculationFailed',
    'seasonMatchingExceptionDetailFetchFailed',
    'seasonMatchingExceptionDetailUnavailable',
    'seasonMatchingExceptionAccessRecheckFailed',
    'seasonMatchingMatchRequestDialog',
    'seasonMatchingMatchRequestPending',
    'seasonMatchingMatchRequestSuccess',
    'seasonMatchingPendingRequests',
    'seasonMatchingMatchRequestFailed',
    'seasonMatchingMatchRequestAlreadyPending',
    'seasonMatchingMatchRequestLimitReached',
    'seasonMatchingMatchRequestTargetMatched',
    'seasonMatchingMatchRequestTargetDeregistered',
    'seasonMatchingBookmarkStaleFailure',
    'seasonMatchingActionBlockedUser',
    'seasonMatchingBlockDialog',
    'seasonMatchingBlockPending',
    'seasonMatchingBlockFailed',
    'seasonMatchingBlockSuccessReceipt',
    'seasonMatchingReportDialog',
    'seasonMatchingReportPending',
    'seasonMatchingReportFailed',
    'seasonMatchingReportSuccessReceipt',
    'seasonMatchingReportOptionalBlockReceipt',
  ],
  postMatch: [
    'postMatchRegistered',
    'postMatchNotRegistered',
    'postMatchDeregistered',
    'postMatchEmpty',
    'postMatchSearchError',
    'postMatchLoadingSkeleton',
  ],
} as const satisfies Record<RoommateStorySeasonGroup, readonly RoommateStoryScenarioKey[]>;

const ISO_NOW = '2026-07-06T03:00:00.000Z';
const TARGET_JIWOO = 'story-roommate-jiwoo';
const TARGET_HAYOON = 'story-roommate-hayoon';
const TARGET_FULL_COMPATIBILITY_DASOM = 'story-roommate-full-dasom';
const TARGET_FULL_COMPATIBILITY_RAHEE = 'story-roommate-full-rahee';
const TARGET_FULL_COMPATIBILITY_YUJIN = 'story-roommate-full-yujin';
const TARGET_FULL_COMPATIBILITY_MINSEO = 'story-roommate-full-minseo';
const TARGET_FULL_COMPATIBILITY_SEOYUN = 'story-roommate-full-seoyun';
const TARGET_FULL_COMPATIBILITY_SUA = 'story-roommate-full-sua';
const TARGET_FULL_COMPATIBILITY_MINJU = 'story-roommate-full-minju';
const TARGET_CAMPUS = 'story-roommate-campus-preview';
const TARGET_VIEWER_ALREADY_MATCHED = 'story-roommate-viewer-already-matched';
const TARGET_TOMBSTONE = 'story-roommate-tombstone';
const TARGET_ERROR = 'story-roommate-hidden';
const TARGET_BLOCKED = 'story-roommate-blocked';

const GENERAL_RELATION: PublicTargetRelation = { type: 'GENERAL' };
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
const POST_MATCH_CLOSED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
};
const VIEWER_ALREADY_MATCHED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
};
const SAFETY_RESTRICTED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['SAFETY_OR_VISIBILITY_RESTRICTED'],
};
const DIRECTION_LIMIT_REACHED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: false,
  canStartChat: true,
  unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
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
    phoneTolerance: 'ANY',
    earphoneExpectation: 'MUST',
    sleepEnvPreference: 'NO_SPEAKER',
    screenTolerance: 'NO_SCREEN',
    indoorEatingTolerance: 'NO_SMELL',
    cleanExpectation: 'STRICT',
    drinkingTolerance: 'LOW_ONLY',
  },
};

const fullCompatibilityViewerLifestyle: LifestyleData = {
  ...storyViewer.lifestyle,
  smokingTolerance: 'E_CIG_OK',
  drinkingTolerance: 'LOW_ONLY',
  noiseSensitivity: 'NORMAL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'LOW_VOLUME_OK',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'LOW_OK',
  cleanExpectation: 'BASIC',
  indoorEatingTolerance: 'CLEAN_OK',
  bedtime: '24_02',
  wakeTime: 'FLEXIBLE',
  temperatureSensitivity: 'NORMAL',
  relationshipStyle: 'CLOSE',
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
  pendingMatchRequest?: RoommateSearchSummary['pendingMatchRequest'];
  activeChatThread?: RoommateSearchSummary['activeChatThread'];
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
    ...(input.pendingMatchRequest !== undefined
      ? { pendingMatchRequest: input.pendingMatchRequest }
      : {}),
    ...(input.activeChatThread !== undefined ? { activeChatThread: input.activeChatThread } : {}),
    ...(input.detailContext ? { detailEntryToken: input.detailContext } : {}),
  };
}

type StorySummaryFactCombination = {
  readonly smokingBehavior: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  readonly sleepHabit: RoommateSearchSummary['profileSummary']['sleepHabit'];
  readonly relationshipStyle: RoommateSearchSummary['profileSummary']['relationshipStyle'];
};

const JIWOO_TWO_LINE_INTRO =
  '아침에는 조용히 준비하고 밤에는 불을 일찍 끄는 편이에요. 시험 기간에는 서로 방해되지 않도록 조명과 알람 시간을 미리 맞추고, 평소에는 주 2회 정도 청소 루틴을 정해 깔끔한 방 분위기를 유지하고 싶어요. 늦은 시간에는 이어폰을 사용하고, 과제나 동아리 일정이 늦어질 때는 미리 공유해서 서로 놀라지 않게 지내고 싶어요. 주말에는 가볍게 카페나 도서관에 가는 편이라 방에서는 조용히 쉬는 시간을 존중해 줄 룸메이트를 찾고 있어요.';

const jiwooSummary = createSummary({
  id: TARGET_JIWOO,
  nickname: '지우',
  intro: JIWOO_TWO_LINE_INTRO,
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
const emptyIntroSummary = createSummary({
  id: 'story-roommate-empty-intro',
  nickname: '무소개',
  intro: '',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 81,
  detailContext: 'story-detail-context-empty-intro',
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
const seasonOpenChattingSummary = createSummary({
  id: 'story-roommate-open-chatting',
  nickname: '오픈대화중',
  intro: '시즌 오픈 기간에 이미 대화를 시작한 같은 건물 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: SEASON_OPEN_SAME_DORMITORY_ACTIONS,
  matchScore: 84,
  detailContext: 'story-detail-context-open-chatting',
  activeChatThread: {
    id: 'story-chat-thread-open',
    threadKind: 'DIRECT',
    status: 'OPEN',
    lastMessageAt: '2026-07-06T05:00:00.000Z',
  },
});
const seasonMatchingChattingSummary = createSummary({
  id: 'story-roommate-matching-chatting',
  nickname: '매칭대화중',
  intro: '매칭 기간에 생활패턴을 확인하며 대화 중인 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 83,
  detailContext: 'story-detail-context-matching-chatting',
  activeChatThread: {
    id: 'story-chat-thread-matching',
    threadKind: 'DIRECT',
    status: 'OPEN',
    lastMessageAt: '2026-07-06T05:30:00.000Z',
  },
});
const sentPendingRequestSummary = createSummary({
  id: 'story-roommate-sent-pending',
  nickname: '보낸요청',
  intro: '이미 보낸 매칭 요청의 응답을 기다리는 후보예요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 82,
  detailContext: 'story-detail-context-sent-pending',
  pendingMatchRequest: {
    id: 'story-match-request-sent',
    direction: 'SENT',
    createdAt: ISO_NOW,
    expiresAt: '2026-07-11T03:00:00.000Z',
  },
});
const receivedPendingRequestSummary = createSummary({
  id: 'story-roommate-received-pending',
  nickname: '받은요청',
  intro: '상대가 먼저 보낸 매칭 요청을 매칭 탭에서 확인할 수 있어요.',
  exposure: FULL_EXPOSURE,
  actions: ACTIONABLE_ACTIONS,
  matchScore: 79,
  detailContext: 'story-detail-context-received-pending',
  pendingMatchRequest: {
    id: 'story-match-request-received',
    direction: 'RECEIVED',
    createdAt: ISO_NOW,
    expiresAt: '2026-07-11T03:00:00.000Z',
  },
});
const directionLimitReachedSummary = createSummary({
  id: 'story-roommate-direction-limit',
  nickname: '횟수초과',
  intro:
    '이번 시즌에 이미 여러 번 요청했던 후보예요. 대화는 가능하지만 새 매칭 요청은 닫혀 있어요.',
  exposure: FULL_EXPOSURE,
  actions: DIRECTION_LIMIT_REACHED_ACTIONS,
  matchScore: 76,
  detailContext: 'story-detail-context-direction-limit',
  sleepHabit: 'SNORING',
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
const viewerAlreadyMatchedSummary = createSummary({
  id: TARGET_VIEWER_ALREADY_MATCHED,
  nickname: '새 후보 제한',
  intro: '이미 매칭이 확정된 상태라 새 후보의 상세 비교와 매칭 요청은 닫혀 있어요.',
  exposure: SUMMARY_ONLY_EXPOSURE,
  actions: VIEWER_ALREADY_MATCHED_ACTIONS,
  smokingBehavior: 'NO',
  sleepHabit: 'NONE',
  relationshipStyle: 'CASUAL',
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
const blockedUserSummary = createSummary({
  id: TARGET_BLOCKED,
  nickname: '숨김 처리된 후보',
  intro: '서버 오류로 이 후보와의 새 행동은 잠시 닫혀 있어요.',
  exposure: { ...SUMMARY_ONLY_EXPOSURE, listSummaryVisible: true },
  actions: SAFETY_RESTRICTED_ACTIONS,
  smokingBehavior: null,
  sleepHabit: null,
  relationshipStyle: null,
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
  additional?: Partial<PublicProfileFullDetail['additional']>;
  gender?: PublicProfileFullDetail['gender'];
  campus?: PublicProfileFullDetail['campus'];
  lifestyle?: Partial<PublicProfileFullDetail['lifestyle']>;
  compatibility?: PublicProfileCompatibility;
}): PublicProfileFullDetail {
  const scoreVisible = input.scoreVisible ?? typeof input.matchScore === 'number';
  const compatibility =
    input.compatibility ??
    (typeof input.matchScore === 'number'
      ? createDefaultPublicProfileCompatibility(input.matchScore)
      : null);

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
      ...input.additional,
    },
    gender: input.gender ?? 'F',
    campus: input.campus ?? 'CHUNCHEON',
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
      ...input.lifestyle,
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
    ...(scoreVisible && compatibility ? { compatibility } : {}),
  };
}

const COMPATIBILITY_DIMENSION_AXIS_IDS = {
  SMOKING: ['SMOKING'],
  SLEEP_RHYTHM: ['BEDTIME', 'WAKE_TIME'],
  SLEEP_HABIT: ['SLEEP_HABIT'],
  SLEEP_ENVIRONMENT: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
  DEVICE_USAGE: ['PHONE', 'EARPHONE'],
  CLEAN_SPACE: ['CLEAN_LEVEL', 'INDOOR_EATING'],
  TEMPERATURE: ['TEMPERATURE'],
  RELATIONSHIP_STYLE: ['RELATIONSHIP'],
} as const satisfies Record<
  PublicProfileCompatibilityDimension['id'],
  readonly PublicProfileCompatibilityAxisId[]
>;

const FULL_COMPATIBILITY_VIEWER_CONDITION_FIXTURE = {
  SMOKING: '전담까지는 OK',
  BEDTIME: '24~02시',
  WAKE_TIME: '수업에 따라 유동적',
  SLEEP_HABIT: '보통',
  SLEEP_ENVIRONMENT: '작은 소리는 괜찮아요',
  SCREEN_USAGE: '밝기 낮추면 괜찮아요',
  TEMPERATURE: '보통',
  PHONE: '가끔·짧게는 괜찮아요',
  EARPHONE: '작게 틀면 괜찮아요',
  CLEAN_LEVEL: '눈에 띄면 정리하면 괜찮아요',
  INDOOR_EATING: '환기·정리 잘하면 OK',
  RELATIONSHIP: '친하게 지내요',
} as const satisfies Record<PublicProfileCompatibilityAxisId, string>;

const DEFAULT_FULL_COMPATIBILITY_TARGET_TEXT = {
  SMOKING: '비흡연',
  BEDTIME: '22~24시 사이에 잠들어요',
  WAKE_TIME: '7~8시에 일어나요',
  SLEEP_HABIT: '잠버릇 없음',
  SLEEP_ENVIRONMENT: '잘 때 전자기기 소리를 틀지 않아요',
  SCREEN_USAGE: '잠들 때 화면을 거의 보지 않아요',
  TEMPERATURE: '온도 민감도는 보통이에요',
  PHONE: '실내 통화는 거의 하지 않아요',
  EARPHONE: '늦은 시간에는 이어폰을 사용해요',
  CLEAN_LEVEL: '주 3회 이상 정리해요',
  INDOOR_EATING: '간단한 간식만 먹어요',
  RELATIONSHIP: '각자 생활하되 필요한 건 이야기해요',
} as const satisfies Record<PublicProfileCompatibilityAxisId, string>;

function createDefaultPublicProfileCompatibility(overallScore: number): PublicProfileCompatibility {
  return createStoryCompatibility({
    overallScore,
    dimensions: [
      createStoryDimension('SMOKING', 100, 'HIGH'),
      createStoryDimension('SLEEP_RHYTHM', 88, 'HIGH'),
      createStoryDimension('SLEEP_HABIT', 95, 'HIGH'),
      createStoryDimension('SLEEP_ENVIRONMENT', 62, 'MEDIUM'),
      createStoryDimension('DEVICE_USAGE', 86, 'HIGH'),
      createStoryDimension('CLEAN_SPACE', 78, 'HIGH'),
      createStoryDimension('TEMPERATURE', 76, 'HIGH'),
      createStoryDimension('RELATIONSHIP_STYLE', 82, 'HIGH'),
    ],
    axes: [
      createStoryAxis('SMOKING', 100, 'HIGH', '비흡연'),
      createStoryAxis('BEDTIME', 86, 'HIGH', '22~24시 사이에 잠들어요'),
      createStoryAxis('WAKE_TIME', 90, 'HIGH', '7~8시에 일어나요'),
      createStoryAxis('SLEEP_HABIT', 95, 'HIGH', '잠버릇 없음'),
      createStoryAxis('SLEEP_ENVIRONMENT', 82, 'HIGH', '잘 때 전자기기 소리를 틀지 않아요'),
      createStoryAxis('SCREEN_USAGE', 42, 'LOW', '잠들 때 화면을 켜는 편이에요'),
      createStoryAxis('TEMPERATURE', 76, 'HIGH', '온도 민감도는 보통이에요'),
      createStoryAxis('PHONE', 86, 'HIGH', '실내 통화를 거의 하지 않아요'),
      createStoryAxis('EARPHONE', 86, 'HIGH', '늦은 시간에는 이어폰을 사용해요'),
      createStoryAxis('CLEAN_LEVEL', 78, 'HIGH', '눈에 띄면 바로 정리해요'),
      createStoryAxis('INDOOR_EATING', 78, 'HIGH', '간단한 간식은 방에서 먹어요'),
      createStoryAxis('RELATIONSHIP', 82, 'HIGH', '각자 생활하되 필요한 건 이야기해요'),
    ],
  });
}

function createStoryCompatibility(input: {
  overallScore: number;
  dimensions: readonly PublicProfileCompatibilityDimension[];
  axes: readonly PublicProfileCompatibilityAxis[];
}): PublicProfileCompatibility {
  return {
    overallScore: input.overallScore,
    dimensions: [...input.dimensions],
    axes: [...input.axes],
    hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
  };
}

function createStoryDimension(
  id: PublicProfileCompatibilityDimension['id'],
  score: number,
  bucket: PublicProfileCompatibilityBucket,
): PublicProfileCompatibilityDimension {
  return { id, score, bucket, axisIds: [...COMPATIBILITY_DIMENSION_AXIS_IDS[id]] };
}

function createStoryAxis(
  id: PublicProfileCompatibilityAxisId,
  score: number | null,
  bucket: PublicProfileCompatibilityBucket,
  targetText: string = DEFAULT_FULL_COMPATIBILITY_TARGET_TEXT[id],
): PublicProfileCompatibilityAxis {
  return {
    id,
    score,
    bucket,
    comparison: {
      targetText,
      viewerText: FULL_COMPATIBILITY_VIEWER_CONDITION_FIXTURE[id],
    },
  };
}

type FullCompatibilityTargetFixture = {
  readonly id: string;
  readonly nickname: string;
  readonly intro: string;
  readonly matchScore: number;
  readonly compatibility: PublicProfileCompatibility;
  readonly additional?: Partial<PublicProfileFullDetail['additional']>;
  readonly lifestyle: Partial<PublicProfileFullDetail['lifestyle']>;
  readonly scoringLifestyle: LifestyleData;
  readonly smokingBehavior: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  readonly sleepHabit: RoommateSearchSummary['profileSummary']['sleepHabit'];
  readonly relationshipStyle: RoommateSearchSummary['profileSummary']['relationshipStyle'];
};

const PUBLIC_PROFILE_DETAIL_LIFESTYLE_FIELDS = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'relationshipStyle',
  'temperatureSensitivity',
] as const satisfies readonly (keyof PublicProfileFullDetail['lifestyle'])[];

function createFullCompatibilityScoringLifestyle(overrides: Partial<LifestyleData>): LifestyleData {
  return {
    ...fullCompatibilityViewerLifestyle,
    drinkingFrequency: 'NONE',
    ...overrides,
  };
}

function pickPublicProfileDetailLifestyle(
  lifestyle: LifestyleData,
): Partial<PublicProfileFullDetail['lifestyle']> {
  return Object.fromEntries(
    PUBLIC_PROFILE_DETAIL_LIFESTYLE_FIELDS.map((field) => [field, lifestyle[field]]),
  ) as Partial<PublicProfileFullDetail['lifestyle']>;
}

function createFullCompatibilityTargetFixture(input: {
  readonly id: string;
  readonly nickname: string;
  readonly intro: string;
  readonly scoringLifestyle: LifestyleData;
  readonly additional?: Partial<PublicProfileFullDetail['additional']>;
}): FullCompatibilityTargetFixture {
  const compatibility = buildPublicProfileCompatibility(
    fullCompatibilityViewerLifestyle,
    input.scoringLifestyle,
  );
  const matchScore = calcViewerMatchScore(fullCompatibilityViewerLifestyle, input.scoringLifestyle);

  if (matchScore !== compatibility.overallScore) {
    throw new Error(`Full compatibility fixture score mismatch: ${input.id}`);
  }

  return {
    id: input.id,
    nickname: input.nickname,
    intro: input.intro,
    matchScore: compatibility.overallScore,
    compatibility,
    ...(input.additional ? { additional: input.additional } : {}),
    lifestyle: pickPublicProfileDetailLifestyle(input.scoringLifestyle),
    scoringLifestyle: input.scoringLifestyle,
    smokingBehavior: input.scoringLifestyle.smokingBehavior,
    sleepHabit: input.scoringLifestyle.sleepHabit,
    relationshipStyle: input.scoringLifestyle.relationshipStyle,
  };
}

const FULL_COMPATIBILITY_TARGET_FIXTURES: readonly FullCompatibilityTargetFixture[] = [
  createFullCompatibilityTargetFixture({
    id: TARGET_JIWOO,
    nickname: '지우',
    intro: JIWOO_TWO_LINE_INTRO,
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      wakeTime: 'AFTER_10',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS',
      indoorEating: 'RARELY',
      cleanLevel: 'WEEKLY_3_UP',
    }),
    additional: { college: 'IT', grade: '3', mbti: 'INFJ', birthYear: 2002 },
  }),

  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_SUA,
    nickname: '수아',
    intro: '화면은 끄고 이어폰으로 음악을 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'BEFORE_22',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'TALKING',
      sleepEnvironment: 'EARPHONE',
      screenUsage: 'AUDIO',
      smokingBehavior: 'E_CIG',
      indoorEating: 'SNACK',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY',
      cleanLevel: 'WEEKLY_3_UP',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'IT', grade: '2', mbti: 'ENFJ', birthYear: 2004 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_HAYOON,
    nickname: '하윤',
    intro: '통화는 거의 없고 영상 소리는 주로 스피커를 작게 쓰는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '22_24',
      wakeTime: '07_08',
      sleepHabit: 'GRINDING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'AUDIO',
      smokingBehavior: 'NO',
      indoorEating: 'MEAL',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WEEKLY_3_UP',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'BUSINESS', grade: '2', mbti: 'ISFJ', birthYear: 2003 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_DASOM,
    nickname: '다솜',
    intro: '가끔 실내 통화를 하고 영상 소리는 주로 스피커를 작게 쓰는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '22_24',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'SNORING',
      sleepEnvironment: 'QUIET',
      screenUsage: 'SCREEN',
      smokingBehavior: 'E_CIG',
      indoorEating: 'RARELY',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'OFTEN',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'COLD',
    }),
    additional: { college: 'ARTS_ENGINEERING', grade: '4+', mbti: 'ENTP', birthYear: 2001 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_RAHEE,
    nickname: '라희',
    intro: '실내 통화는 거의 없지만 영상 소리를 항상 스피커로 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '24_02',
      wakeTime: '08_09',
      sleepHabit: 'NONE',
      sleepEnvironment: 'EARPHONE',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'SNACK',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS_SPEAKER',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'OFTEN',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'HOT',
    }),
    additional: { college: 'SOCIAL_SCIENCES', grade: '1', mbti: 'INTJ', birthYear: 2006 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_YUJIN,
    nickname: '유진',
    intro: '실내 통화는 자주 하지만 영상 소리는 항상 이어폰으로 듣는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: '24_02',
      wakeTime: 'FLEXIBLE',
      sleepHabit: 'TALKING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'MEAL',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WEEKLY_1_2',
      drinkingFrequency: 'RARELY',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'NATURAL_SCIENCES', grade: '3', mbti: 'INTP', birthYear: 2002 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_MINSEO,
    nickname: '민서',
    intro: '화면을 보면서 스피커를 작게 트는 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'AFTER_02',
      wakeTime: '09_10',
      sleepHabit: 'GRINDING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'RARELY',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'MOSTLY_SPEAKER',
      cleanLevel: 'WHEN_DIRTY',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'NORMAL',
    }),
    additional: { college: 'HUMANITIES', grade: '2', mbti: 'ENFP', birthYear: 2004 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_SEOYUN,
    nickname: '서윤',
    intro: '화면 빛과 스피커 소리가 함께 있어 가장 조율이 필요한 조합이에요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      bedtime: 'AFTER_02',
      wakeTime: 'AFTER_10',
      sleepHabit: 'SNORING',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      smokingBehavior: 'YES',
      indoorEating: 'MEAL',
      phoneBehavior: 'OFTEN',
      earphoneUsage: 'ALWAYS_SPEAKER',
      cleanLevel: 'WHEN_DIRTY',
      drinkingFrequency: 'SOMETIMES',
      relationshipStyle: 'CLOSE',
      temperatureSensitivity: 'HOT',
    }),
    additional: { college: 'OPEN_MAJOR', grade: '1', mbti: 'ESFP', birthYear: 2006 },
  }),
  createFullCompatibilityTargetFixture({
    id: TARGET_FULL_COMPATIBILITY_MINJU,
    nickname: '민주',
    intro: '보편적인 생활 기준에 가까운 후보로, 화면과 소리 사용을 함께 비교해 볼 수 있어요.',
    scoringLifestyle: createFullCompatibilityScoringLifestyle({
      smokingBehavior: 'NO',
      drinkingFrequency: 'SOMETIMES',
      sleepHabit: 'NONE',
      phoneBehavior: 'SOMETIMES',
      earphoneUsage: 'MOSTLY_SPEAKER',
      sleepEnvironment: 'LOW_SPEAKER',
      screenUsage: 'SCREEN',
      cleanLevel: 'WEEKLY_1_2',
      indoorEatingTolerance: 'CLEAN_OK',
      bedtime: '24_02',
      wakeTime: 'FLEXIBLE',
      temperatureSensitivity: 'NORMAL',
      relationshipStyle: 'CLOSE',
    }),
    additional: { college: 'BUSINESS', grade: '3', mbti: 'ESFJ', birthYear: 2003 },
  }),
];

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
    intro: JIWOO_TWO_LINE_INTRO,
    matchScore: 92,
  }),
  [TARGET_HAYOON]: createPublicProfileFull({
    id: TARGET_HAYOON,
    nickname: '하윤',
    intro: '청소 주기를 미리 맞춰두는 편이에요.',
    matchScore: 85,
  }),
  [TARGET_TOMBSTONE]: createPublicProfileTombstone({
    id: TARGET_TOMBSTONE,
    displayName: '하린',
    message: '상대가 시즌 참여를 철회해 프로필을 볼 수 없어요.',
  }),
};

const fullCompatibilitySummaries = FULL_COMPATIBILITY_TARGET_FIXTURES.map((target, index) =>
  createSummary({
    id: target.id,
    nickname: target.nickname,
    intro: target.intro,
    exposure: FULL_EXPOSURE,
    actions: ACTIONABLE_ACTIONS,
    matchScore: target.matchScore,
    bookmarked: index === 1,
    detailContext: `story-detail-context-full-compatibility-${index + 1}`,
    ...(target.smokingBehavior ? { smokingBehavior: target.smokingBehavior } : {}),
    ...(target.sleepHabit ? { sleepHabit: target.sleepHabit } : {}),
    ...(target.relationshipStyle ? { relationshipStyle: target.relationshipStyle } : {}),
  }),
);

const fullCompatibilityProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    FULL_COMPATIBILITY_TARGET_FIXTURES.map((target) => [
      target.id,
      createPublicProfileFull({
        id: target.id,
        nickname: target.nickname,
        intro: target.intro,
        matchScore: target.matchScore,
        ...(target.additional ? { additional: target.additional } : {}),
        lifestyle: target.lifestyle,
        compatibility: target.compatibility,
      }),
    ]),
  ),
};

const seasonOpenProfileByTargetUserId: Readonly<Record<string, PublicProfile>> = {
  ...defaultProfiles,
  ...Object.fromEntries(
    [...seasonOpenSameDormitorySummaries, seasonOpenChattingSummary].map((summary) => [
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
    [
      ...seasonMatchingSameDormitorySummaries,
      seasonMatchingChattingSummary,
      sentPendingRequestSummary,
      receivedPendingRequestSummary,
      directionLimitReachedSummary,
    ].map((summary) => [
      summary.id,
      createPublicProfileFull({
        id: summary.id,
        nickname: summary.profileSummary.nickname,
        intro: summary.profileSummary.intro ?? '매칭 기간 같은 건물 후보 상세 정보예요.',
        matchScore: summary.matchScore,
        actions: summary.actions,
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
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

const SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

const DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

const DEREGISTERED_SAME_DORMITORY_EMPTY_STATE = {
  title: '시즌 참여 철회 후 같은 건물 후보를 볼 수 없어요.',
  message: '캠퍼스 전체 요약은 볼 수 있지만, 같은 건물 후보 리스트와 생활패턴 비교는 닫혀요.',
} as const;

const actionableSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [jiwooSummary, hayoonSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const fullCompatibilitySearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: fullCompatibilitySummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const scoreCalculationFailedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [scoreCalculationFailedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const emptyIntroDetailSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [emptyIntroSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

const seasonMatchingRegisteredSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: seasonMatchingSameDormitorySummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingRegisteredChattingSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [seasonMatchingChattingSummary, ...seasonMatchingSameDormitorySummaries.slice(0, 2)],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const seasonMatchingRegisteredChattingSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredChattingSearch,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

const seasonMatchingActiveMatchedSearch = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingActiveMatchedSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  notices: [
    {
      code: 'MATCHED_TARGETS_EXCLUDED',
      severity: 'INFO',
      message: '이미 매칭된 상태에서는 새 후보 매칭 행동이 닫혀요.',
    },
  ],
  items: [viewerAlreadyMatchedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingActiveMatchedSearchResponses = {
  CAMPUS_MERGED: seasonMatchingActiveMatchedSearch,
  SAME_BUILDING_ONLY: seasonMatchingActiveMatchedSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

const seasonMatchingUnmatchedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [jiwooSummary, hayoonSummary, directionLimitReachedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingUnmatchedSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingUnmatchedSearch,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

const seasonMatchingPendingRequestsSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [sentPendingRequestSummary, receivedPendingRequestSummary],
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
const seasonMatchingNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingNotRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingNotRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const seasonMatchingNotRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonMatchingNotRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonMatchingNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

const seasonMatchingDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

const seasonMatchingDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

const seasonMatchingRegisteredEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'FILTER_RESULT_EMPTY', severity: 'INFO' }],
  items: [],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
const seasonMatchingRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

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
const seasonOpenRegisteredChattingSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [seasonOpenChattingSummary, ...seasonOpenSameDormitorySummaries.slice(0, 2)],
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
  purpose: 'BROAD_PREVIEW',
  items: [],
});

const seasonOpenDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

const seasonOpenDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
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
const seasonOpenDeregisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const seasonMatchingDeregisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const POST_MATCH_NOT_REGISTERED_SAME_DORMITORY_EMPTY_STATE = {
  title: '시즌 등록 이력이 있어야 목록을 볼 수 있어요.',
  message: '같은 건물 시즌 참여자 목록은 시즌 참여한 사용자에게만 열려요.',
} as const;

const postMatchSameDormitorySummaries = seasonOpenSameDormitorySummaries
  .slice(0, 6)
  .map((summary, index) => {
    const {
      matchScore: _matchScore,
      detailEntryToken: _detailEntryToken,
      ...summaryWithoutDetail
    } = summary;
    void _matchScore;
    void _detailEntryToken;

    return {
      ...summaryWithoutDetail,
      exposure: SUMMARY_ONLY_EXPOSURE,
      actions: POST_MATCH_CLOSED_ACTIONS,
      resultRead: NO_RESULT_READ,
      profileSummary: {
        ...summary.profileSummary,
        intro:
          index % 2 === 0
            ? `${summary.profileSummary.nickname}님은 같은 건물에서 시즌에 참여했던 사용자예요. 결과 정리 기간에는 요약만 확인할 수 있어요.`
            : `${summary.profileSummary.nickname}님의 공개 요약을 확인해 보세요. 새 요청과 상세 비교는 매칭 기간에만 열려요.`,
      },
      bookmark: { bookmarked: false },
    };
  });

const postMatchCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: seasonOpenCampusPreviewSummaries.slice(0, 6),
});
const postMatchSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: postMatchSameDormitorySummaries,
});
const postMatchCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
const postMatchSameDormitoryEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
const postMatchNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
const postMatchDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});
const postMatchDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: seasonOpenCampusPreviewSummaries.slice(0, 6),
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});
const postMatchRegisteredSearchResponses = {
  CAMPUS_MERGED: postMatchCampusMerged,
  SAME_BUILDING_ONLY: postMatchSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const postMatchNotRegisteredSearchResponses = {
  CAMPUS_MERGED: postMatchCampusMerged,
  SAME_BUILDING_ONLY: postMatchNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const postMatchDeregisteredSearchResponses = {
  CAMPUS_MERGED: postMatchDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: postMatchDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
const postMatchEmptySearchResponses = {
  CAMPUS_MERGED: postMatchCampusMergedEmpty,
  SAME_BUILDING_ONLY: postMatchSameDormitoryEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
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
const blockedUserActionClosedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'WARNING' }],
  items: [blockedUserSummary],
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
