import {
  CORE_LIFESTYLE_FIELDS,
  lifestyleSchema,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import {
  currentSeasonResponseSchema,
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
  smokingTolerance: null,
  phoneTolerance: null,
  earphoneExpectation: null,
  sleepEnvPreference: null,
  screenTolerance: null,
  indoorEatingTolerance: null,
  cleanExpectation: null,
  drinkingTolerance: 'LOW_ONLY',
};

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

  it('dormitory contract는 selection state와 guide response shape를 유지한다', () => {
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

  it('roommate search contract는 summary shape와 appliedSort를 유지한다', () => {
    expect(
      roommateSearchQuerySchema.parse({
        smokingBehavior: 'NO',
      }),
    ).toMatchObject({
      smokingBehavior: 'NO',
    });

    expect(
      roommateSearchResponseSchema.parse({
        scope: 'CAMPUS_MERGED',
        appliedSort: 'MATCH_SCORE',
        effectiveVisibility: 'MIXED_VISIBILITY',
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
          college: true,
          grade: true,
          mbti: true,
          birthYear: true,
        },
        sortCapabilities: {
          matchScore: true,
        },
        items: [
          {
            id: 'user-1',
            sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
            relationToViewer: 'GENERAL',
            actions: {
              canBookmark: true,
              canRequestMatch: true,
              canStartChat: true,
            },
            canViewFull: true,
            nickname: '테스터',
            intro: '소개',
            messageToRoommate: null,
            additional: {
              college: null,
              grade: null,
              mbti: null,
              birthYear: null,
            },
            matchScore: 87,
          },
        ],
      }),
    ).toMatchObject({
      scope: 'CAMPUS_MERGED',
      appliedSort: 'MATCH_SCORE',
      effectiveVisibility: 'MIXED_VISIBILITY',
    });
  });
});
