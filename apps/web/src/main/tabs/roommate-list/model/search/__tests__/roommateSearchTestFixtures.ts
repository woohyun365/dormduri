import type {
  RoommateSearchAvailabilityNotice,
  RoommateSearchManifest,
  RoommateSearchManifestResponse,
  RoommateSearchPurpose,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search/contract';

export function createManifest(
  overrides: Partial<RoommateSearchManifest> = {},
): RoommateSearchManifest {
  const scope = overrides.scope ?? 'SAME_BUILDING_ONLY';
  const purpose = overrides.purpose ?? 'ACTIONABLE_DETAIL_DISCOVERY';
  const actionable = purpose === 'ACTIONABLE_DETAIL_DISCOVERY';

  return {
    manifestRevision: overrides.manifestRevision ?? `manifest-${scope}-${purpose}`,
    scope,
    purpose,
    filters:
      overrides.filters ??
      (actionable
        ? {
            enabled: true,
            fields: createActionableFields(),
          }
        : {
            enabled: false,
            fields: {},
          }),
    sorts:
      overrides.sorts ??
      (actionable
        ? { default: 'MATCH_SCORE', options: ['NICKNAME', 'MATCH_SCORE'] }
        : { default: 'NICKNAME', options: ['NICKNAME'] }),
  };
}

export function createCampusMergedManifest(): RoommateSearchManifest {
  return createManifest({
    manifestRevision: 'manifest-campus-merged',
    scope: 'CAMPUS_MERGED',
    purpose: 'BROAD_PREVIEW',
    filters: { enabled: false, fields: {} },
    sorts: { default: 'NICKNAME', options: ['NICKNAME'] },
  });
}

export function createPostMatchManifest(): RoommateSearchManifest {
  return createManifest({
    manifestRevision: 'manifest-post-match',
    scope: 'SAME_BUILDING_ONLY',
    purpose: 'POST_MATCH_COHORT_REVIEW',
    filters: { enabled: false, fields: {} },
    sorts: { default: 'NICKNAME', options: ['NICKNAME'] },
  });
}

export function createManifestResponse(
  manifest: RoommateSearchManifest = createManifest(),
  availabilityNotices: RoommateSearchAvailabilityNotice[] = [],
): RoommateSearchManifestResponse {
  return {
    scope: manifest.scope,
    scopeAvailability: {
      campusMerged: true,
      sameBuildingOnly: true,
    },
    manifest,
    availabilityNotices,
  };
}

export function createSearchResponse(
  input: {
    manifest?: RoommateSearchManifest;
    items?: RoommateSearchSummary[];
    nextCursor?: string | null;
    notices?: RoommateSearchAvailabilityNotice[];
    appliedSort?: RoommateSearchSort;
    scope?: RoommateSearchScope;
    purpose?: RoommateSearchPurpose;
  } = {},
): RoommateSearchResponse {
  const manifest =
    input.manifest ??
    createManifest({
      scope: input.scope,
      purpose: input.purpose,
      sorts: input.appliedSort
        ? { default: input.appliedSort, options: [input.appliedSort] }
        : undefined,
    });

  return {
    scope: manifest.scope,
    appliedSort: input.appliedSort ?? manifest.sorts.default,
    resultSummary: {
      summaryOnlyCount: 0,
      detailViewableCount: input.items?.length ?? 1,
      scoreVisibleCount: input.items?.length ?? 1,
    },
    scopeAvailability: {
      campusMerged: true,
      sameBuildingOnly: true,
    },
    manifest,
    pageInfo: {
      hasNextPage: input.nextCursor !== null && input.nextCursor !== undefined,
      nextCursor: input.nextCursor ?? null,
    },
    availabilityNotices: input.notices ?? [],
    items: input.items ?? [createSummary('participant-1')],
  };
}

export function createSummary(id: string): RoommateSearchSummary {
  return {
    id,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'GENERAL' },
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: true,
    },
    actions: {
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: false,
      unavailableReasons: [],
    },
    resultRead: {
      resultReadable: false,
      context: 'NONE',
    },
    profileSummary: {
      nickname: `테스트-${id}`,
      intro: '조용한 생활을 선호해요.',
      smokingBehavior: 'NO',
      sleepHabit: 'NONE',
      relationshipStyle: 'CASUAL',
    },
    bookmark: {
      bookmarked: false,
    },
    detailEntryToken: `detail-token-${id}`,
    matchScore: 88,
  };
}

function createActionableFields(): RoommateSearchManifest['filters']['fields'] {
  return {
    smokingBehavior: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [
        { code: 'NO', label: '비흡연' },
        { code: 'E_CIG', label: '전자담배' },
        { code: 'YES', label: '흡연' },
      ],
    },
    bedtime: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: '24_02', label: '24~02시' }],
    },
    wakeTime: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: '07_08', label: '07~08시' }],
    },
    noiseSensitivity: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: 'SENSITIVE', label: '예민함' }],
    },
    cleanLevel: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: 'WEEKLY_3_UP', label: '주 3회 이상' }],
    },
    sleepHabit: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [
        { code: 'NONE', label: '없음' },
        { code: 'HAS', label: '있음' },
      ],
    },
    indoorEating: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: 'RARELY', label: '거의 안 함' }],
    },
    relationshipStyle: {
      enabled: true,
      source: 'LIFESTYLE_FIELD_OPTIONS',
      options: [{ code: 'CASUAL', label: '적당한 거리' }],
    },
    college: {
      enabled: true,
      source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
      operators: ['INCLUDE', 'EXCLUDE'],
      options: [
        { code: 'ENGINEERING', label: '공과대학' },
        { code: 'HUMANITIES', label: '인문대학' },
      ],
    },
    grade: {
      enabled: true,
      source: 'PROFILE_ENUM',
      operators: ['INCLUDE'],
      options: [
        { code: '1', label: '1학년' },
        { code: '2', label: '2학년' },
        { code: '3', label: '3학년' },
        { code: '4+', label: '4학년 이상' },
      ],
    },
    mbtiTraits: {
      enabled: true,
      source: 'MBTI_TRAITS',
      options: ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'].map((code) => ({ code, label: code })),
    },
    ageBand: {
      enabled: true,
      source: 'AGE_BAND',
      options: [
        { code: '20', label: '20세 (2007년생)' },
        { code: '21', label: '21세 (2006년생)' },
        { code: '25_PLUS', label: '25세 이상 (2002년생 이하)' },
      ],
    },
    minScore: {
      enabled: true,
      source: 'MATCH_SCORE_PRESET',
      options: [
        { code: '90', label: '90점 이상' },
        { code: '80', label: '80점 이상' },
        { code: '70', label: '70점 이상' },
        { code: '60', label: '60점 이상' },
      ],
    },
  };
}
