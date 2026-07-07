import { describe, expect, it } from 'vitest';
import {
  roommateSearchManifestQuerySchema,
  roommateSearchManifestResponseSchema,
  roommateSearchQuerySchema,
  roommateSearchResponseSchema,
} from '@repo/shared/roommate-search/contract';
import { publicProfileSchema } from '@repo/shared/profile/contract';
import { createMatchRequestSchema, matchRequestSummarySchema } from '@repo/shared/match/contract';

const SUMMARY_ITEM = {
  id: 'participant-1',
  sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
  relation: { type: 'GENERAL' },
  exposure: {
    listSummaryVisible: true,
    canViewFull: false,
    detailViewable: false,
    scoreVisible: false,
  },
  actions: {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
    unavailableReasons: ['VIEWER_NOT_REGISTERED'],
  },
  resultRead: {
    resultReadable: false,
    context: 'NONE',
  },
  profileSummary: {
    nickname: '테스터',
    intro: '소개',
    smokingBehavior: 'NO',
    sleepHabit: 'NONE',
    relationshipStyle: 'CLOSE',
  },
} as const;

const PUBLIC_PROFILE_DETAIL = {
  id: 'participant-1',
  detailState: 'FULL',
  sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
  relation: { type: 'MATCHED_PARTNER' },
  exposure: {
    listSummaryVisible: true,
    detailViewable: true,
    canViewFull: true,
    scoreVisible: true,
  },
  actions: {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: true,
    unavailableReasons: [],
  },
  resultRead: {
    resultReadable: true,
    context: 'CURRENT_MATCHED_PARTNER',
  },
  nickname: '스냅샷닉',
  intro: '소개',
  additional: {
    college: null,
    grade: null,
    mbti: null,
    birthYear: null,
  },
  gender: 'M',
  campus: 'CHUNCHEON',
  lifestyle: {
    bedtime: '22_24',
    wakeTime: '07_08',
    sleepHabit: 'NONE',
    sleepEnvironment: 'QUIET',
    screenUsage: 'NONE',
    noiseSensitivity: 'NORMAL',
    smokingBehavior: 'NO',
    indoorEating: 'SNACK',
    phoneBehavior: 'SOMETIMES',
    earphoneUsage: 'MOSTLY',
    cleanLevel: 'WEEKLY_3_UP',
    relationshipStyle: 'CLOSE',
    temperatureSensitivity: 'NORMAL',
  },
  matchScore: 87,
} as const;

const PUBLIC_PROFILE_TOMBSTONE_DETAIL = {
  id: 'participant-1',
  detailState: 'TOMBSTONE',
  relation: { type: 'MATCHED_PARTNER' },
  exposure: {
    listSummaryVisible: false,
    detailViewable: true,
    canViewFull: false,
    scoreVisible: false,
  },
  actions: {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
    unavailableReasons: ['TARGET_NOT_PUBLIC'],
  },
  resultRead: {
    resultReadable: true,
    context: 'PAST_MATCH_HISTORY',
  },
  tombstone: {
    reason: 'TARGET_NO_LONGER_DISCOVERABLE',
    displayName: '탈퇴한 사용자',
    message: '상대가 시즌 참여를 철회했거나 더 이상 공개 가능한 상태가 아닙니다.',
  },
} as const;

const UNSUPPORTED_CAPABILITY_BOOLEAN_RESPONSE = {
  scope: 'CAMPUS_MERGED',
  appliedSort: 'NICKNAME',
  resultSummary: {
    summaryOnlyCount: 1,
    detailViewableCount: 0,
    scoreVisibleCount: 0,
  },
  scopeAvailability: {
    campusMerged: true,
    sameBuildingOnly: true,
  },
  filterCapabilities: {
    smokingBehavior: true,
    bedtime: true,
    wakeTime: true,
    noiseSensitivity: true,
    cleanLevel: true,
    sleepHabit: true,
    indoorEating: true,
    relationshipStyle: true,
    college: false,
    grade: false,
    mbti: false,
    birthYear: false,
  },
  sortCapabilities: {
    matchScore: false,
  },
  pageInfo: {
    hasNextPage: false,
    nextCursor: null,
  },
  availabilityNotices: [
    {
      code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE',
      severity: 'INFO',
      message: '현재 등록 또는 기숙사 배정 상태에 따라 사용할 수 있는 검색 범위가 제한됩니다.',
    },
  ],
  items: [SUMMARY_ITEM],
} as const;

const ROOMMATE_SEARCH_MANIFEST_RESPONSE = {
  scope: 'SAME_BUILDING_ONLY',
  appliedSort: 'MATCH_SCORE',
  resultSummary: {
    summaryOnlyCount: 0,
    detailViewableCount: 1,
    scoreVisibleCount: 1,
  },
  scopeAvailability: {
    campusMerged: true,
    sameBuildingOnly: true,
  },
  manifest: {
    manifestRevision: 'same-building:v1:college-rev-1',
    scope: 'SAME_BUILDING_ONLY',
    purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
    filters: {
      enabled: true,
      fields: {
        smokingBehavior: { enabled: true, source: 'SHARED_ENUM' },
        college: {
          enabled: true,
          source: 'VIEWER_CAMPUS_ACTIVE_CATALOG',
          operators: ['INCLUDE', 'EXCLUDE'],
          options: [{ code: 'ARTS_ENGINEERING', label: '문화예술·공과대학' }],
        },
        grade: { enabled: true, source: 'SHARED_ENUM' },
        mbtiTraits: { enabled: true, source: 'SHARED_MBTI_TRAITS' },
        ageBand: { enabled: true, source: 'SEASON_REFERENCE_YEAR' },
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
      },
    },
    sorts: {
      default: 'MATCH_SCORE',
      options: ['NICKNAME', 'MATCH_SCORE'],
    },
  },
  pageInfo: {
    hasNextPage: false,
    nextCursor: null,
  },
  availabilityNotices: [],
  items: [{ ...SUMMARY_ITEM, matchScore: 87 }],
} as const;

const ROOMMATE_SEARCH_PREFLIGHT_MANIFEST_RESPONSE = {
  scope: ROOMMATE_SEARCH_MANIFEST_RESPONSE.scope,
  scopeAvailability: ROOMMATE_SEARCH_MANIFEST_RESPONSE.scopeAvailability,
  manifest: ROOMMATE_SEARCH_MANIFEST_RESPONSE.manifest,
  availabilityNotices: ROOMMATE_SEARCH_MANIFEST_RESPONSE.availabilityNotices,
} as const;

describe('profile and matching shared reference contracts', () => {
  it('public profile contract는 exposure enum 없이 capability 기반 detail target shape만 허용한다', () => {
    expect(publicProfileSchema.parse(PUBLIC_PROFILE_DETAIL)).toMatchObject({
      detailState: 'FULL',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      exposure: { canViewFull: true, detailViewable: true },
      relation: { type: 'MATCHED_PARTNER' },
    });
    expect(publicProfileSchema.parse(PUBLIC_PROFILE_TOMBSTONE_DETAIL)).toMatchObject({
      detailState: 'TOMBSTONE',
      exposure: { canViewFull: false, detailViewable: true },
      tombstone: { reason: 'TARGET_NO_LONGER_DISCOVERABLE' },
    });

    expect(
      publicProfileSchema.safeParse({
        ...PUBLIC_PROFILE_DETAIL,
        unsupportedDetailField: true,
      }).success,
    ).toBe(false);
  });

  it('roommate search contract는 manifest 기반 summary response shape를 사용한다', () => {
    expect(roommateSearchResponseSchema.safeParse(ROOMMATE_SEARCH_MANIFEST_RESPONSE).success).toBe(
      true,
    );

    expect(
      roommateSearchResponseSchema.safeParse({
        ...ROOMMATE_SEARCH_MANIFEST_RESPONSE,
        unsupportedSearchScopeField: true,
      }).success,
    ).toBe(false);

    expect(
      roommateSearchResponseSchema.safeParse({
        ...ROOMMATE_SEARCH_MANIFEST_RESPONSE,
        items: [{ ...SUMMARY_ITEM, unsupportedSummaryField: true }],
      }).success,
    ).toBe(false);
  });

  it('roommate search contract는 manifest/sort 계약을 요구하고 old capability boolean bridge를 거부한다', () => {
    expect(
      roommateSearchResponseSchema.safeParse(UNSUPPORTED_CAPABILITY_BOOLEAN_RESPONSE).success,
    ).toBe(false);
  });

  it('roommate search manifest preflight contract는 list response와 같은 manifest owner shape를 사용한다', () => {
    expect(
      roommateSearchManifestQuerySchema.safeParse({ scope: 'SAME_BUILDING_ONLY' }).success,
    ).toBe(true);
    expect(roommateSearchManifestQuerySchema.safeParse({ scope: 'UNKNOWN' }).success).toBe(false);
    expect(
      roommateSearchManifestResponseSchema.safeParse(ROOMMATE_SEARCH_PREFLIGHT_MANIFEST_RESPONSE)
        .success,
    ).toBe(true);
    expect(
      roommateSearchManifestResponseSchema.safeParse({
        ...ROOMMATE_SEARCH_PREFLIGHT_MANIFEST_RESPONSE,
        items: [],
      }).success,
    ).toBe(false);
  });

  it('roommate search query contract는 dotted nested filters를 normalized filter object로 받는다', () => {
    const parsed = roommateSearchQuerySchema.safeParse({
      scope: 'SAME_BUILDING_ONLY',
      sort: 'MATCH_SCORE',
      'college.operator': 'EXCLUDE',
      'college.values[]': ['ARTS_ENGINEERING', 'NURSING'],
      'grade.operator': 'INCLUDE',
      'grade.values[]': ['1', '2', '3', '4+'],
      'mbtiTraits.energy': 'I',
      'mbtiTraits.perception': 'N',
      'mbtiTraits.decision': 'F',
      'ageBand.values[]': ['20', '21', '22', '23', '24', '25_PLUS'],
      minScore: '80',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;
    expect(parsed.data.college).toEqual({
      operator: 'EXCLUDE',
      values: ['ARTS_ENGINEERING', 'NURSING'],
    });
    expect(parsed.data.grade).toEqual({
      operator: 'INCLUDE',
      values: ['1', '2', '3', '4+'],
    });
    expect(parsed.data.mbtiTraits).toEqual({
      energy: 'I',
      perception: 'N',
      decision: 'F',
    });
    expect(parsed.data.ageBand).toEqual({
      values: ['20', '21', '22', '23', '24', '25_PLUS'],
    });

    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        minScore: 75,
      }).success,
    ).toBe(false);

    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        excludeMyCollege: true,
      }).success,
    ).toBe(false);
  });

  it('roommate search college filter는 INCLUDE/EXCLUDE 중 single operator만 허용한다', () => {
    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        'college.operator': 'EXCLUDE',
        'college.values[]': ['ARTS_ENGINEERING'],
      }).success,
    ).toBe(true);

    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        'college.operators[]': ['INCLUDE', 'EXCLUDE'],
        'college.values[]': ['ARTS_ENGINEERING'],
      }).success,
    ).toBe(false);

    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        college: {
          include: ['ARTS_ENGINEERING'],
          exclude: ['NURSING'],
        },
      }).success,
    ).toBe(false);
  });

  it('match request contract는 요청 surface 필드 없이 roommate-search summary projection을 재사용한다', () => {
    expect(
      createMatchRequestSchema.parse({
        targetUserId: 'user-2',
        note: '안녕하세요',
      }),
    ).toMatchObject({ targetUserId: 'user-2' });

    expect(
      createMatchRequestSchema.safeParse({
        targetUserId: 'user-2',
        unsupportedRequestField: true,
      }).success,
    ).toBe(false);

    expect(
      matchRequestSummarySchema.parse({
        id: 'request-1',
        seasonId: 'season-1',
        direction: 'SENT',
        counterpartUserId: 'user-2',
        counterpartParticipantId: 'participant-2',
        counterpartSummary: SUMMARY_ITEM,
        status: 'PENDING',
        note: null,
        createdAt: '2026-05-20T00:00:00.000Z',
        expiresAt: '2026-05-25T00:00:00.000Z',
        terminalAt: null,
        acceptedAt: null,
        terminalReason: null,
      }),
    ).toMatchObject({ counterpartSummary: { profileSummary: { nickname: '테스터' } } });

    expect(
      matchRequestSummarySchema.safeParse({
        id: 'request-1',
        seasonId: 'season-1',
        direction: 'SENT',
        counterpartUserId: 'user-2',
        counterpartParticipantId: 'participant-2',
        counterpartSummary: SUMMARY_ITEM,
        status: 'PENDING',
        note: null,
        createdAt: '2026-05-20T00:00:00.000Z',
        expiresAt: '2026-05-25T00:00:00.000Z',
        terminalAt: null,
        acceptedAt: null,
        terminalReason: null,
        unsupportedSummaryField: true,
      }).success,
    ).toBe(false);
  });
});
