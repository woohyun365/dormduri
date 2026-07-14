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
import type {
  PublicProfileActionCapabilities,
  PublicTargetExposure,
  PublicTargetRelation,
  PublicTargetResultRead,
} from '@repo/shared/profile/contract';
import type { LifestyleData } from '@repo/shared/lifestyle';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import type { UserProfile } from '@/types/profile';
import { ROOMMATE_STORY_AGE_BAND_CODES } from './roommateStoryTypes';

export const ISO_NOW = '2026-07-06T03:00:00.000Z';
export const TARGET_JIWOO = 'story-roommate-jiwoo';
export const TARGET_HAYOON = 'story-roommate-hayoon';
export const TARGET_FULL_COMPATIBILITY_DASOM = 'story-roommate-full-dasom';
export const TARGET_FULL_COMPATIBILITY_RAHEE = 'story-roommate-full-rahee';
export const TARGET_FULL_COMPATIBILITY_YUJIN = 'story-roommate-full-yujin';
export const TARGET_FULL_COMPATIBILITY_MINSEO = 'story-roommate-full-minseo';
export const TARGET_FULL_COMPATIBILITY_SEOYUN = 'story-roommate-full-seoyun';
export const TARGET_FULL_COMPATIBILITY_SUA = 'story-roommate-full-sua';
export const TARGET_FULL_COMPATIBILITY_MINJU = 'story-roommate-full-minju';
export const TARGET_CAMPUS = 'story-roommate-campus-preview';
export const TARGET_VIEWER_ALREADY_MATCHED = 'story-roommate-viewer-already-matched';
export const TARGET_TOMBSTONE = 'story-roommate-tombstone';
export const TARGET_ERROR = 'story-roommate-hidden';
export const TARGET_BLOCKED = 'story-roommate-blocked';

export const GENERAL_RELATION: PublicTargetRelation = { type: 'GENERAL' };
export const FULL_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: true,
  canViewFull: true,
  scoreVisible: true,
};
export const SUMMARY_ONLY_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: false,
  canViewFull: false,
  scoreVisible: false,
};
export const TOMBSTONE_EXPOSURE: PublicTargetExposure = {
  listSummaryVisible: true,
  detailViewable: false,
  canViewFull: false,
  scoreVisible: false,
};
export const NO_RESULT_READ: PublicTargetResultRead = { resultReadable: false, context: 'NONE' };
export const ACTIONABLE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: true,
  canStartChat: true,
  unavailableReasons: [],
};
export const SEASON_OPEN_SAME_DORMITORY_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: false,
  canStartChat: true,
  unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
};
export const SUMMARY_ONLY_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['DIFFERENT_DORMITORY'],
};
export const POST_MATCH_CLOSED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
};
export const VIEWER_ALREADY_MATCHED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
};
export const SAFETY_RESTRICTED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['SAFETY_OR_VISIBILITY_RESTRICTED'],
};
export const DIRECTION_LIMIT_REACHED_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: true,
  canRequestMatch: false,
  canStartChat: true,
  unavailableReasons: ['MATCH_REQUEST_DIRECTION_LIMIT_REACHED'],
};
export const TOMBSTONE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
  unavailableReasons: ['TARGET_DELETED_OR_DEIDENTIFIED'],
};

export const storyViewer: UserProfile = {
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

export const fullCompatibilityViewerLifestyle: LifestyleData = {
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

export function createSeasonContext(state: SeasonContextValue['state']): SeasonContextValue {
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

export function parseRoommateStorySeasonYear(value: string): number | null {
  const match = /(\d{4})/u.exec(value);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

export function formatRoommateStoryAgeBandLabel(
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

export function createManifest(
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

export function lifestyleField(
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

export const DEFAULT_SCOPE_AVAILABILITY: RoommateSearchResponse['scopeAvailability'] = {
  campusMerged: true,
  sameBuildingOnly: true,
};

export function createManifestResponse(
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

export function createSearchResponse(input: {
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

export function createSearchResultSummary(
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

export function createSummary(input: {
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

export type StorySummaryFactCombination = {
  readonly smokingBehavior: RoommateSearchSummary['profileSummary']['smokingBehavior'];
  readonly sleepHabit: RoommateSearchSummary['profileSummary']['sleepHabit'];
  readonly relationshipStyle: RoommateSearchSummary['profileSummary']['relationshipStyle'];
};
