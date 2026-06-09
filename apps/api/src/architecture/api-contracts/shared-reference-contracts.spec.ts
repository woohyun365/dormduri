import {
  CORE_LIFESTYLE_FIELDS,
  lifestyleSchema,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import {
  roommateSearchManifestQuerySchema,
  roommateSearchManifestResponseSchema,
  roommateSearchQuerySchema,
  roommateSearchResponseSchema,
} from '@repo/shared/roommate-search-contract';
import { publicProfileSchema } from '@repo/shared/profile-contract';
import {
  SERVICE_INTRO_NOTICE_KEY,
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
  updateCurrentUserRequestSchema,
  updateCurrentUserResponseSchema,
} from '@repo/shared/user';
import {
  displayIdentityEditUnavailableReasonSchema,
  userDisplayIdentitySchema,
} from '@repo/shared/user/identity/display';
import { userAcademicIdentitySchema } from '@repo/shared/user/identity/academic';
import {
  accountIdentityIncompleteErrorSchema,
  accountIdentitySchema,
} from '@repo/shared/user/identity/account';
import { createMatchRequestSchema, matchRequestSummarySchema } from '@repo/shared/match-contract';
import {
  isLocalDateString,
  toDateOnlyString,
  toIsoDateTimeString,
} from '@repo/shared/date-primitives';

const VALID_LIFESTYLE: LifestyleData = {
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
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

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

const LEGACY_ROOMMATE_SEARCH_RESPONSE = {
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

const COMPLETION_READY = {
  profileCompletionRequired: false,
  dormitorySelectionRequired: false,
  registrationUnavailable: false,
  registrationUnavailableReasons: [],
} as const;

describe('shared reference contracts', () => {
  it('lifestyle schema는 필수 필드 null과 screen/sleep invariant를 계속 강제한다', () => {
    const missingRequired = lifestyleSchema.safeParse({
      ...VALID_LIFESTYLE,
      [CORE_LIFESTYLE_FIELDS[0]]: null,
    });
    expect(missingRequired.success).toBe(true);

    const inconsistentSleep = lifestyleSchema.safeParse({
      ...VALID_LIFESTYLE,
      screenUsage: 'NONE',
      sleepEnvironment: 'EARPHONE',
    });
    expect(inconsistentSleep.success).toBe(false);

    for (const field of ROOMMATE_CONDITION_FIELDS) {
      const optionalCondition = lifestyleSchema.safeParse({
        ...VALID_LIFESTYLE,
        [field]: null,
      });
      expect(optionalCondition.success).toBe(true);
    }
  });

  it('account identity contract는 display identity와 academic identity를 user contract barrel이 아니라 전용 contract에서 소유한다', () => {
    expect(
      userDisplayIdentitySchema.parse({
        userId: 'user-1',
        nickname: '테스터',
        nicknameSource: 'USER_DISPLAY_IDENTITY',
        nicknameChangedAt: null,
      }),
    ).toMatchObject({ nicknameSource: 'USER_DISPLAY_IDENTITY' });
    expect(displayIdentityEditUnavailableReasonSchema.parse('NICKNAME_COOLDOWN_ACTIVE')).toBe(
      'NICKNAME_COOLDOWN_ACTIVE',
    );

    expect(
      userAcademicIdentitySchema.parse({
        collegeCode: 'IT',
        birthYear: 2002,
      }),
    ).toEqual({ collegeCode: 'IT', birthYear: 2002 });

    expect(
      accountIdentitySchema.parse({
        displayIdentity: {
          userId: 'user-1',
          nickname: '테스터',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
        academicIdentity: {
          collegeCode: 'IT',
          birthYear: 2002,
        },
      }),
    ).toMatchObject({
      displayIdentity: { nickname: '테스터' },
      academicIdentity: { collegeCode: 'IT' },
    });
    expect(
      accountIdentityIncompleteErrorSchema.parse({
        code: 'ACCOUNT_IDENTITY_INCOMPLETE',
        error: '계정 identity가 완성되지 않았습니다.',
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        context: 'current-user',
      }),
    ).toMatchObject({ invariant: 'USER_DISPLAY_IDENTITY_REQUIRED' });
  });

  it('current-user contract는 registration 준비 UI의 display/academic identity 표시 source를 표현한다', () => {
    expect(
      currentUserResponseSchema.parse({
        user: {
          id: 'user-1',
          email: 'student@kangwon.ac.kr',
          nickname: '테스터',
          gender: 'M',
          campus: 'CHUNCHEON',
        },
        displayIdentity: {
          userId: 'user-1',
          nickname: '테스터',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
        academicIdentity: {
          collegeCode: 'IT',
          birthYear: 2002,
        },
        seasonProfile: {
          hasCurrentSeason: true,
          hasParticipantRow: true,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: true,
          profileState: 'COMPLETE',
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: false,
            registrationUnavailableReasons: [],
          },
          draftWritable: true,
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
        selection: {
          state: 'NOT_SELECTED',
          dormitoryId: null,
          source: 'SEASON_PARTICIPANT',
        },
        match: {
          hasActiveMatch: false,
          activeMatch: null,
        },
        capabilities: {
          canEnterRoommateSearch: true,
          canCreateOrUpdateSeasonProfileDraft: true,
          canSelectDormitory: true,
          canFinalizeSeasonRegistration: false,
          canEditDisplayIdentity: true,
          displayIdentityEditUnavailableReasons: [],
          canEditAcademicIdentity: true,
          academicIdentityEditUnavailableReasons: [],
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
        },
        onboarding: {
          dismissedNotices: [
            {
              noticeKey: SERVICE_INTRO_NOTICE_KEY,
              dismissed: true,
              dismissedAt: '2026-05-20T00:00:00.000Z',
            },
          ],
        },
        serviceState: {
          campusOperated: true,
          seasonState: 'SEASON_OPEN',
        },
      }),
    ).toMatchObject({
      displayIdentity: { nicknameSource: 'USER_DISPLAY_IDENTITY' },
      seasonProfile: { profileState: 'COMPLETE' },
      onboarding: { dismissedNotices: [{ dismissed: true }] },
    });
  });

  it('onboarding dismiss request는 service-intro notice key만 허용하고 이전 onboarding key를 거부한다', () => {
    expect(
      dismissCurrentUserOnboardingNoticeRequestSchema.parse({
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
      }),
    ).toEqual({ noticeKey: SERVICE_INTRO_NOTICE_KEY });

    expect(
      dismissCurrentUserOnboardingNoticeRequestSchema.safeParse({
        noticeKey: 'season-profile-onboarding',
      }).success,
    ).toBe(false);
  });

  it('user update request는 display identity와 account academic identity 변경만 받고 selection/message/season profile write를 분리한다', () => {
    expect(
      updateCurrentUserRequestSchema.parse({
        displayIdentity: { nickname: '새닉네임' },
      }),
    ).toMatchObject({ displayIdentity: { nickname: '새닉네임' } });
    expect(
      updateCurrentUserRequestSchema.parse({
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      }),
    ).toMatchObject({
      academicIdentity: {
        collegeCode: 'NURSING',
        birthYear: 2001,
      },
    });

    expect(
      updateCurrentUserRequestSchema.safeParse({
        selection: { state: 'ASSIGNED', dormitoryId: 'dasan' },
      }).success,
    ).toBe(false);
    expect(updateCurrentUserRequestSchema.safeParse({ intro: '시즌 프로필 소개' }).success).toBe(
      false,
    );
    expect(updateCurrentUserRequestSchema.safeParse({ unsupportedUserPatch: true }).success).toBe(
      false,
    );

    expect(
      updateCurrentUserResponseSchema.parse({
        currentUser: {
          user: {
            id: 'user-1',
            email: 'student@kangwon.ac.kr',
            nickname: '테스터',
            gender: 'M',
            campus: 'CHUNCHEON',
          },
          displayIdentity: {
            userId: 'user-1',
            nickname: '테스터',
            nicknameSource: 'USER_DISPLAY_IDENTITY',
            nicknameChangedAt: null,
          },
          academicIdentity: {
            collegeCode: 'NURSING',
            birthYear: 2001,
          },
          seasonProfile: {
            hasCurrentSeason: true,
            hasParticipantRow: true,
            intent: 'UNDECIDED',
            registered: false,
            profileExists: true,
            profileState: 'COMPLETE',
            completion: COMPLETION_READY,
            draftWritable: true,
            canSelectDormitory: true,
            canFinalizeRegistration: false,
          },
          selection: {
            state: 'NOT_SELECTED',
            dormitoryId: null,
            source: 'SEASON_PARTICIPANT',
          },
          match: {
            hasActiveMatch: false,
            activeMatch: null,
          },
          capabilities: {
            canEnterRoommateSearch: true,
            canCreateOrUpdateSeasonProfileDraft: true,
            canSelectDormitory: true,
            canFinalizeSeasonRegistration: false,
            canEditDisplayIdentity: true,
            displayIdentityEditUnavailableReasons: [],
            canEditAcademicIdentity: true,
            academicIdentityEditUnavailableReasons: [],
            canBookmark: false,
            canRequestMatch: false,
            canStartChat: false,
          },
          onboarding: {
            dismissedNotices: [],
          },
          serviceState: {
            campusOperated: true,
            seasonState: 'SEASON_OPEN',
          },
        },
        mutation: {
          displayIdentity: {
            attempted: true,
            changed: false,
            noOpReason: 'SAME_NICKNAME',
          },
          academicIdentity: {
            attempted: false,
            changed: false,
            noOpReason: null,
          },
        },
      }).mutation,
    ).toMatchObject({
      displayIdentity: {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_NICKNAME',
      },
      academicIdentity: {
        attempted: false,
        changed: false,
        noOpReason: null,
      },
    });
  });

  it('date primitives는 local/iso normalization과 guard를 유지한다', () => {
    expect(isLocalDateString('2026-05-09')).toBe(true);
    expect(isLocalDateString('2026/05/09')).toBe(false);
    expect(toDateOnlyString(new Date('2026-05-09T10:00:00.000Z'))).toBe('2026-05-09');
    expect(toIsoDateTimeString('2026-05-09T10:00:00.000Z')).toBe('2026-05-09T10:00:00.000Z');
  });

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

  it('roommate search contract는 manifest/sort 계약을 요구하고 legacy capability boolean bridge를 거부한다', () => {
    expect(roommateSearchResponseSchema.safeParse(LEGACY_ROOMMATE_SEARCH_RESPONSE).success).toBe(
      false,
    );
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
    expect(
      roommateSearchQuerySchema.safeParse({
        scope: 'SAME_BUILDING_ONLY',
        sort: 'MATCH_SCORE',
        'college.operator': 'EXCLUDE',
        'college.values[]': ['ARTS_ENGINEERING'],
        'mbtiTraits.energy': 'E',
        'mbtiTraits.decision': 'T',
        'ageBand.values[]': ['20', '21'],
        minScore: '80',
      }).success,
    ).toBe(true);

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
