import {
  CORE_LIFESTYLE_FIELDS,
  lifestyleSchema,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import {
  currentSeasonResponseSchema,
  createSeasonProfileRequestSchema,
  dormitorySelectionDraftResponseSchema,
  seasonProfileDraftResponseSchema,
  seasonRegistrationFinalizeRequestSchema,
  seasonRegistrationFinalizeResponseSchema,
  selectableDormitoriesResponseSchema,
  selectedDormitorySubmitRequestSchema,
  seasonRuntimeOverrideSchema,
} from '@repo/shared/season-contract';
import {
  dormitoryGuideResponseSchema,
  dormitorySelectionStateSchema,
} from '@repo/shared/dormitory-contract';
import {
  roommateSearchQuerySchema,
  roommateSearchResponseSchema,
} from '@repo/shared/roommate-search-contract';
import { publicProfileSchema } from '@repo/shared/profile-contract';
import {
  SERVICE_INTRO_NOTICE_KEY,
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
  updateCurrentUserRequestSchema,
} from '@repo/shared/user-contract';
import {
  signupDraftValidationRequestSchema,
  signupRequestSchema,
} from '@repo/shared/auth-contract';
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
  relationToViewer: 'GENERAL',
  summaryVisible: true,
  canViewFull: false,
  detailViewable: false,
  scoreVisible: false,
  actions: {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
  },
  nickname: '테스터',
  intro: '소개',
  smokingBehavior: 'NO',
  sleepHabit: 'NONE',
  relationshipStyle: 'CLOSE',
} as const;

const PUBLIC_PROFILE_DETAIL = {
  id: 'participant-1',
  sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
  relationToViewer: 'MATCHED_PARTNER',
  capabilities: {
    summaryVisible: true,
    detailViewable: true,
    canViewFull: true,
    scoreVisible: true,
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: true,
    },
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

const ROOMMATE_SEARCH_RESPONSE = {
  scope: 'CAMPUS_MERGED',
  appliedSort: 'MATCH_SCORE',
  resultSummary: {
    summaryOnlyCount: 1,
    detailViewableCount: 0,
    scoreVisibleCount: 0,
  },
  scopeCapabilities: {
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
  items: [SUMMARY_ITEM],
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

  it('auth signup request는 profile orchestration 필드를 받지 않는다', () => {
    expect(
      signupRequestSchema.parse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
      }),
    ).toMatchObject({ nickname: '테스터' });

    expect(
      signupRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
        lifestyle: VALID_LIFESTYLE,
        intro: '가입 단계 소개',
      }).success,
    ).toBe(false);
  });

  it('auth signup draft validation request는 email/password/nickname만 받는다', () => {
    expect(
      signupDraftValidationRequestSchema.parse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
      }),
    ).toEqual({
      email: 'student@kangwon.ac.kr',
      password: 'pass1234',
      nickname: '테스터',
    });

    expect(
      signupDraftValidationRequestSchema.safeParse({
        email: 'student@kangwon.ac.kr',
        password: 'pass1234',
        nickname: '테스터',
        lifestyle: VALID_LIFESTYLE,
        intro: '가입 단계 소개',
        profile: { intro: 'signup 단계 프로필' },
      }).success,
    ).toBe(false);
  });

  it('current-user contract는 display identity, season profile state, onboarding notice를 표현한다', () => {
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
          canBrowseProfiles: true,
          canCreateOrUpdateSeasonProfileDraft: true,
          canSelectDormitory: true,
          canFinalizeSeasonRegistration: false,
          canEditDisplayIdentity: true,
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

  it('onboarding dismiss request는 지원 notice key만 허용한다', () => {
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

  it('user update request는 selection/message patch와 season profile write를 분리한다', () => {
    expect(
      updateCurrentUserRequestSchema.parse({
        displayIdentity: { nickname: '새닉네임' },
      }),
    ).toMatchObject({ displayIdentity: { nickname: '새닉네임' } });

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
  });

  it('date primitives는 local/iso normalization과 guard를 유지한다', () => {
    expect(isLocalDateString('2026-05-09')).toBe(true);
    expect(isLocalDateString('2026/05/09')).toBe(false);
    expect(toDateOnlyString(new Date('2026-05-09T10:00:00.000Z'))).toBe('2026-05-09');
    expect(toIsoDateTimeString('2026-05-09T10:00:00.000Z')).toBe('2026-05-09T10:00:00.000Z');
  });

  it('season runtime/current-season response contract shape를 유지한다', () => {
    expect(
      seasonRuntimeOverrideSchema.parse({
        active: false,
        state: null,
        reason: null,
        startedAt: null,
        endsAt: null,
      }),
    ).toMatchObject({ active: false, state: null });

    expect(
      currentSeasonResponseSchema.parse({
        campusCode: 'CHUNCHEON',
        season: {
          id: 'season-1',
          name: '2026 1학기',
          preparationStartDate: '2026-01-01',
          matchingStartDate: '2026-01-28',
          seasonEndDate: '2026-02-28',
        },
        operatedDormitories: [
          {
            dormitoryId: 'dasan',
            isOperated: true,
            roomSelectionDate: '2026-02-11',
          },
        ],
        state: 'SEASON_MATCHING',
        isActive: true,
        isOpen: false,
        isMatching: true,
        isPostMatch: false,
        daysUntilMatchingEnd: 3,
        daysUntilSeasonEnd: 20,
        schedule: {
          preparationStart: '2026-01-01',
          matchingStart: '2026-01-28',
          matchingEnd: '2026-02-12',
          seasonEnd: '2026-02-28',
        },
        override: {
          active: false,
          state: null,
          reason: null,
          startedAt: null,
          endsAt: null,
        },
      }),
    ).toMatchObject({ state: 'SEASON_MATCHING', isMatching: true });
  });

  it('season participation/dormitory selection contract가 draft, 선택 목록, finalize를 표현한다', () => {
    expect(
      createSeasonProfileRequestSchema.parse({
        lifestyle: VALID_LIFESTYLE,
        intro: '시즌 프로필 소개',
      }),
    ).toMatchObject({ intro: '시즌 프로필 소개' });

    expect(
      seasonProfileDraftResponseSchema.parse({
        participantId: null,
        seasonId: 'season-1',
        state: 'NONE',
        lifestyle: Object.fromEntries(
          [...CORE_LIFESTYLE_FIELDS, ...ROOMMATE_CONDITION_FIELDS].map((field) => [field, null]),
        ),
        intro: '',
        additional: {
          college: null,
          grade: null,
          mbti: null,
          birthYear: null,
        },
        completion: {
          profileCompletionRequired: true,
          dormitorySelectionRequired: true,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
        },
        draftWritable: true,
      }),
    ).toMatchObject({ participantId: null, state: 'NONE' });

    expect(
      selectableDormitoriesResponseSchema.parse({
        seasonId: 'season-1',
        seasonState: 'SEASON_OPEN',
        profileState: 'COMPLETE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: true,
          registrationUnavailable: false,
          registrationUnavailableReasons: [],
        },
        items: [
          {
            id: 'dasan',
            name: '다산관',
            campusCode: 'CHUNCHEON',
            roomType: 2,
            genderPolicy: 'M',
            roomSelectionDate: '2026-02-11',
          },
        ],
      }),
    ).toMatchObject({ profileState: 'COMPLETE', items: [{ id: 'dasan' }] });

    expect(selectedDormitorySubmitRequestSchema.parse({ dormitoryId: 'dasan' })).toMatchObject({
      dormitoryId: 'dasan',
    });

    expect(
      dormitorySelectionDraftResponseSchema.parse({
        seasonId: 'season-1',
        participantId: 'participant-1',
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profileState: 'COMPLETE',
        completion: COMPLETION_READY,
      }),
    ).toMatchObject({ dormitorySelectionState: 'SELECTED', dormitoryId: 'dasan' });

    expect(seasonRegistrationFinalizeRequestSchema.parse({})).toEqual({});
    expect(
      seasonRegistrationFinalizeRequestSchema.safeParse({ dormitoryId: 'dasan' }).success,
    ).toBe(false);

    expect(
      seasonRegistrationFinalizeResponseSchema.parse({
        seasonId: 'season-1',
        participantId: 'participant-1',
        participationIntent: 'REGISTERED',
        registeredAt: '2026-05-20T00:00:00.000Z',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        profileState: 'REGISTRATION_FINALIZED',
        profileHistoryId: 'history-1',
        registeredAtSnapshot: '2026-05-20T00:00:00.000Z',
        completion: COMPLETION_READY,
      }),
    ).toMatchObject({ dormitorySelectionState: 'ASSIGNED' });
  });

  it('dormitory contract는 selection state와 guide response shape를 유지한다', () => {
    expect(dormitorySelectionStateSchema.parse('SELECTED')).toBe('SELECTED');
    expect(dormitorySelectionStateSchema.parse('ASSIGNED')).toBe('ASSIGNED');
    expect(dormitorySelectionStateSchema.safeParse('UNKNOWN').success).toBe(false);

    expect(
      dormitoryGuideResponseSchema.parse({
        dormitory: {
          id: 'dasan',
          name: '다산관',
          roomType: 2,
        },
        guide: {
          bathroomType: 'SHARED',
          facilities: ['laundry'],
          repairContact: '033-000-0000',
          diningContact: null,
        },
        commonRules: [{ emoji: '🧹', label: '청소', value: '주 1회' }],
        emergencyContacts: [{ label: '행정실', value: '033-111-1111' }],
        homepageUrl: 'https://example.com',
      }),
    ).toMatchObject({
      dormitory: { id: 'dasan', roomType: 2 },
      guide: { bathroomType: 'SHARED' },
    });
  });

  it('public profile contract는 capability 기반 detail target shape만 허용한다', () => {
    expect(publicProfileSchema.parse(PUBLIC_PROFILE_DETAIL)).toMatchObject({
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      capabilities: { canViewFull: true, detailViewable: true },
    });

    expect(
      publicProfileSchema.safeParse({
        ...PUBLIC_PROFILE_DETAIL,
        unsupportedDetailField: true,
      }).success,
    ).toBe(false);
  });

  it('roommate search contract는 capability 기반 단일 summary shape를 사용한다', () => {
    expect(
      roommateSearchQuerySchema.parse({
        smokingBehavior: 'NO',
      }),
    ).toMatchObject({ smokingBehavior: 'NO' });

    expect(roommateSearchResponseSchema.parse(ROOMMATE_SEARCH_RESPONSE)).toMatchObject({
      scope: 'CAMPUS_MERGED',
      resultSummary: { summaryOnlyCount: 1 },
      items: [{ summaryVisible: true, canViewFull: false }],
    });

    expect(
      roommateSearchResponseSchema.safeParse({
        ...ROOMMATE_SEARCH_RESPONSE,
        unsupportedSearchScopeField: true,
      }).success,
    ).toBe(false);

    expect(
      roommateSearchResponseSchema.safeParse({
        ...ROOMMATE_SEARCH_RESPONSE,
        items: [{ ...SUMMARY_ITEM, unsupportedSummaryField: true }],
      }).success,
    ).toBe(false);
  });

  it('match request contract는 roommate-search summary projection을 재사용한다', () => {
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
    ).toMatchObject({ counterpartSummary: { nickname: '테스터' } });

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
