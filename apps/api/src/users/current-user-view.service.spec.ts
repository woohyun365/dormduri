import { InternalServerErrorException } from '@nestjs/common';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { toLifestyleColumnData } from '../profiles/profile-lifestyle.persistence.js';
import { CurrentUserViewService } from './current-user-view.service.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');
const completeLifestyle = {
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
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

function makeUser() {
  return {
    id: 'user-1',
    email: 'student@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    displayIdentity: {
      userId: 'user-1',
      nickname: '테스터',
      nicknameNormalized: '테스터',
      nicknameChangedAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    dismissedNotices: [],
  };
}

function makeParticipant(profileOverrides: Record<string, unknown> | null = {}) {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
    declinedAt: null,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participantStatus: 'NOT_STARTED',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: NOW,
    activatedAt: null,
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    profile:
      profileOverrides === null
        ? null
        : {
            participantId: 'participant-1',
            nicknameSnapshot: '테스터',
            nicknameNormalizedSnapshot: '테스터',
            ...toLifestyleColumnData(completeLifestyle),
            intro: '소개',
            collegeCode: null,
            grade: null,
            mbti: null,
            birthYear: null,
            createdAt: NOW,
            updatedAt: NOW,
            ...profileOverrides,
          },
  };
}

describe('CurrentUserViewService identity invariant', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: { findUnique: jest.fn() },
    campusMaster: { findUnique: jest.fn() },
    seasonParticipant: { findUnique: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const seasonParticipantsService = {
    pickCurrentSeasonParticipant: jest.fn((items: unknown[]) => items[0] ?? null),
    validateSeasonProfileCompleteness: jest.fn(() => ({ complete: false })),
    hasSelectableDormitoriesForCurrentParticipant: jest.fn(),
    hasSelectableDormitoriesForCurrentUser: jest.fn(),
    hasValidDormitorySelectionForCurrentParticipant: jest.fn(),
  };
  const matchesService = { getCurrentActiveMatchSummaryForParticipant: jest.fn() };
  const service = new CurrentUserViewService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(NOW);
  });

  it('current-user는 display identity 없이 정상 response를 만들지 않고 invariant error를 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-legacy',
      email: 'legacy@kangwon.ac.kr',
      emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
      dismissedNotices: [],
    });

    try {
      await service.getCurrentUser({ id: 'user-legacy', gender: 'M', campus: 'CHUNCHEON' });
      throw new Error('Expected current-user invariant violation');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as InternalServerErrorException).getResponse()).toMatchObject({
        success: false,
        code: 'ACCOUNT_IDENTITY_INCOMPLETE',
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        surface: 'current-user',
      });
    }

    expect(prisma.campusMaster.findUnique).not.toHaveBeenCalled();
    expect(prisma.seasonParticipant.findUnique).not.toHaveBeenCalled();
    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).not.toHaveBeenCalled();
  });
});

describe('CurrentUserViewService season profile/registration state', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: { findUnique: jest.fn() },
    campusMaster: { findUnique: jest.fn() },
    seasonParticipant: { findUnique: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const seasonParticipantsService = {
    validateSeasonProfileCompleteness: jest.fn(),
    hasSelectableDormitoriesForCurrentParticipant: jest.fn(),
    hasSelectableDormitoriesForCurrentUser: jest.fn(),
    hasValidDormitorySelectionForCurrentParticipant: jest.fn(),
    pickCurrentSeasonParticipant: jest.fn((items: unknown[]) => items[0] ?? null),
  };
  const matchesService = { getCurrentActiveMatchSummaryForParticipant: jest.fn() };
  const service = new CurrentUserViewService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-06-01' },
      ],
      schedule: {
        preparationStart: '2026-05-01',
        matchingStart: '2026-05-10',
        matchingEnd: '2026-06-01',
        seasonEnd: '2026-06-15',
      },
    });
    matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue(null);
    seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant.mockResolvedValue(true);
    seasonParticipantsService.hasSelectableDormitoriesForCurrentUser.mockResolvedValue(true);
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      false,
    );
  });

  it('complete draft + selectable dormitory가 있으면 selection은 열고 finalize는 선택 전까지 닫는다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeParticipant());
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({ complete: true });

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.seasonProfile.profileState).toBe('COMPLETE');
    expect(result.seasonProfile.completion.profileCompletionRequired).toBe(false);
    expect(result.seasonProfile.completion.dormitorySelectionRequired).toBe(true);
    expect(result.seasonProfile.canSelectDormitory).toBe(true);
    expect(result.seasonProfile.canFinalizeRegistration).toBe(false);
    expect(result.capabilities.canSelectDormitory).toBe(true);
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(false);
  });

  it('SELECTED dormitory가 유효하면 registration finalize capability를 연다', async () => {
    const selected = {
      ...makeParticipant(),
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
    };
    prisma.seasonParticipant.findUnique.mockResolvedValue(selected);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({ complete: true });
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      true,
    );

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.selection).toMatchObject({ state: 'SELECTED', dormitoryId: 'dasan' });
    expect(result.seasonProfile.completion.dormitorySelectionRequired).toBe(false);
    expect(result.seasonProfile.canSelectDormitory).toBe(true);
    expect(result.seasonProfile.canFinalizeRegistration).toBe(true);
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(true);
  });

  it('incomplete draft도 dormitory selection은 열 수 있지만 finalize는 닫는다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      makeParticipant({ drinkingTolerance: null }),
    );
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({
      complete: false,
    });

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.seasonProfile.profileState).toBe('DRAFT');
    expect(result.seasonProfile.completion.registrationUnavailableReasons).toContain(
      'PROFILE_INCOMPLETE',
    );
    expect(result.seasonProfile.canSelectDormitory).toBe(true);
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(false);
  });

  it('SELECTED dormitory가 유효해도 profile이 incomplete이면 finalize capability를 닫는다', async () => {
    const selected = {
      ...makeParticipant({ drinkingTolerance: null }),
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
    };
    prisma.seasonParticipant.findUnique.mockResolvedValue(selected);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({
      complete: false,
    });
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      true,
    );

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.selection).toMatchObject({ state: 'SELECTED', dormitoryId: 'dasan' });
    expect(result.seasonProfile.completion.profileCompletionRequired).toBe(true);
    expect(result.seasonProfile.completion.dormitorySelectionRequired).toBe(false);
    expect(result.seasonProfile.canSelectDormitory).toBe(true);
    expect(result.seasonProfile.canFinalizeRegistration).toBe(false);
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(false);
  });

  it('participant row가 없어도 사용자 snapshot 기준 selectable dormitory가 있으면 selection capability는 열린다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(null);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({
      complete: false,
    });
    seasonParticipantsService.hasSelectableDormitoriesForCurrentUser.mockResolvedValue(true);

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(
      seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant,
    ).not.toHaveBeenCalled();
    expect(seasonParticipantsService.hasSelectableDormitoriesForCurrentUser).toHaveBeenCalledWith(
      {
        id: 'user-1',
        emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      expect.objectContaining({ season: { id: 'season-1' } }),
      NOW,
    );
    expect(result.seasonProfile.hasParticipantRow).toBe(false);
    expect(result.seasonProfile.profileState).toBe('NONE');
    expect(result.seasonProfile.canSelectDormitory).toBe(true);
    expect(result.seasonProfile.canFinalizeRegistration).toBe(false);
    expect(result.capabilities.canSelectDormitory).toBe(true);
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(false);
  });

  it('REGISTERED+ASSIGNED는 finalized state이고 draft/selection/finalize capability를 닫는다', async () => {
    const registered = {
      ...makeParticipant(),
      participationIntent: 'REGISTERED',
      registeredAt: NOW,
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      participantStatus: 'ACTIVE',
    };
    prisma.seasonParticipant.findUnique.mockResolvedValue(registered);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({ complete: true });

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.seasonProfile.registered).toBe(true);
    expect(result.seasonProfile.profileState).toBe('REGISTRATION_FINALIZED');
    expect(result.seasonProfile.draftWritable).toBe(false);
    expect(result.capabilities.canCreateOrUpdateSeasonProfileDraft).toBe(false);
    expect(result.capabilities.canSelectDormitory).toBe(false);
  });

  it('onboarding service-intro 상태는 season profile/registration과 독립이다', async () => {
    const registered = {
      ...makeParticipant(),
      participationIntent: 'REGISTERED',
      registeredAt: NOW,
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      participantStatus: 'ACTIVE',
    };
    prisma.seasonParticipant.findUnique.mockResolvedValue(registered);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({ complete: true });

    const result = await service.buildCurrentUserResponse(
      {
        ...makeUser(),
        dismissedNotices: [
          {
            noticeKey: SERVICE_INTRO_NOTICE_KEY,
            dismissedAt: new Date('2026-05-20T00:00:00.000Z'),
          },
        ],
      },
      NOW,
    );

    expect(result.seasonProfile.registered).toBe(true);
    expect(result.onboarding.dismissedNotices).toEqual([
      {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissed: true,
        dismissedAt: '2026-05-20T00:00:00.000Z',
      },
    ]);
  });
});
