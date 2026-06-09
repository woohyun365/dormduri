import { InternalServerErrorException } from '@nestjs/common';
import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { CurrentUserQuery } from './current-user.query.js';
import { CurrentUserViewService } from './current-user-view.service.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');

const seasonContext = {
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
    academicIdentity: {
      userId: 'user-1',
      collegeCode: 'IT',
      birthYear: 2002,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    dismissedNotices: [],
  };
}

function makeSeasonSegment(overrides: Record<string, unknown> = {}) {
  return {
    participant: { id: 'participant-1' },
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
        registrationUnavailable: true,
        registrationUnavailableReasons: ['DORMITORY_SELECTION_REQUIRED'],
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
    capabilities: {
      canCreateOrUpdateSeasonProfileDraft: true,
      canSelectDormitory: true,
      canFinalizeSeasonRegistration: false,
    },
    ...overrides,
  };
}

function createServiceTestKit() {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: { findUnique: jest.fn() },
    campusMaster: { findUnique: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const currentSeasonParticipationViewOwner = {
    buildCurrentUserSeasonParticipationSegment: jest.fn(),
  };
  const matchesService = { getCurrentActiveMatchSummaryForParticipant: jest.fn() };
  const currentUserQuery = new CurrentUserQuery(prisma as never);
  const service = new CurrentUserViewService(
    prisma as never,
    currentUserQuery,
    seasonsService as never,
    currentSeasonParticipationViewOwner as never,
    matchesService as never,
  );

  prisma.getDatabaseNow.mockResolvedValue(NOW);
  prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
  seasonsService.getCurrentSeasonContext.mockResolvedValue(seasonContext);
  currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment.mockResolvedValue(
    makeSeasonSegment(),
  );
  matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue(null);

  return {
    service,
    prisma,
    seasonsService,
    currentSeasonParticipationViewOwner,
    matchesService,
  };
}

describe('CurrentUserViewService identity invariant', () => {
  it('current-user는 display identity 없이 정상 response를 만들지 않고 invariant error를 던진다', async () => {
    const { service, prisma, currentSeasonParticipationViewOwner, matchesService } =
      createServiceTestKit();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-missing-display-identity',
      email: 'missing-display-identity@kangwon.ac.kr',
      emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
      academicIdentity: {
        userId: 'user-missing-display-identity',
        collegeCode: 'IT',
        birthYear: 2002,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      dismissedNotices: [],
    });

    try {
      await service.getCurrentUser({
        id: 'user-missing-display-identity',
        gender: 'M',
        campus: 'CHUNCHEON',
      });
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
    expect(
      currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment,
    ).not.toHaveBeenCalled();
    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).not.toHaveBeenCalled();
  });

  it('current-user는 academic identity 없이 정상 response를 만들지 않고 invariant error를 던진다', async () => {
    const { service, prisma, currentSeasonParticipationViewOwner, matchesService } =
      createServiceTestKit();
    prisma.user.findUnique.mockResolvedValue({
      ...makeUser(),
      id: 'user-missing-academic-identity',
      email: 'missing-academic-identity@kangwon.ac.kr',
      academicIdentity: null,
    });

    try {
      await service.getCurrentUser({
        id: 'user-missing-academic-identity',
        gender: 'M',
        campus: 'CHUNCHEON',
      });
      throw new Error('Expected current-user academic invariant violation');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as InternalServerErrorException).getResponse()).toMatchObject({
        success: false,
        code: 'ACCOUNT_IDENTITY_INCOMPLETE',
        invariant: 'USER_ACADEMIC_IDENTITY_REQUIRED',
        surface: 'current-user',
      });
    }

    expect(prisma.campusMaster.findUnique).not.toHaveBeenCalled();
    expect(
      currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment,
    ).not.toHaveBeenCalled();
    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).not.toHaveBeenCalled();
  });
});

describe('CurrentUserViewService season composition boundary', () => {
  it('current-user는 season segment owner 결과를 response shape에 조합한다', async () => {
    const { service, currentSeasonParticipationViewOwner, matchesService } = createServiceTestKit();

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(
      currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment,
    ).toHaveBeenCalledWith({
      user: {
        id: 'user-1',
        emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
        gender: 'M',
        campus: 'CHUNCHEON',
        deletedAt: null,
      },
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext,
      now: NOW,
    });
    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).toHaveBeenCalledWith(
      seasonContext,
      'participant-1',
      NOW,
    );
    expect(result).toMatchObject({
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
        profileState: 'COMPLETE',
        canSelectDormitory: true,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'NOT_SELECTED',
        dormitoryId: null,
        source: 'SEASON_PARTICIPANT',
      },
      capabilities: {
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: false,
        canEditDisplayIdentity: true,
        displayIdentityEditUnavailableReasons: [],
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      serviceState: {
        campusOperated: true,
        seasonState: 'SEASON_OPEN',
      },
    });
  });

  it('registration 완료 current season 사용자는 display identity edit capability를 닫고 registration snapshot lock reason을 반환한다', async () => {
    const { service, currentSeasonParticipationViewOwner } = createServiceTestKit();
    currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment.mockResolvedValueOnce(
      makeSeasonSegment({
        seasonProfile: {
          ...makeSeasonSegment().seasonProfile,
          registered: true,
          profileState: 'REGISTRATION_FINALIZED',
          draftWritable: false,
          canSelectDormitory: false,
          canFinalizeRegistration: false,
        },
        capabilities: {
          canCreateOrUpdateSeasonProfileDraft: false,
          canSelectDormitory: false,
          canFinalizeSeasonRegistration: false,
        },
      }),
    );

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.capabilities.canEditDisplayIdentity).toBe(false);
    expect(result.capabilities.displayIdentityEditUnavailableReasons).toEqual([
      'CURRENT_SEASON_REGISTRATION_LOCK',
    ]);
  });

  it('nickname cooldown은 registration 전 사용자 display identity edit capability reason으로만 반영된다', async () => {
    const { service } = createServiceTestKit();

    const result = await service.buildCurrentUserResponse(
      {
        ...makeUser(),
        displayIdentity: {
          ...makeUser().displayIdentity,
          nicknameChangedAt: new Date('2026-05-20T23:59:00.000Z'),
        },
      },
      NOW,
    );

    expect(result.capabilities.canEditDisplayIdentity).toBe(false);
    expect(result.capabilities.displayIdentityEditUnavailableReasons).toEqual([
      'NICKNAME_COOLDOWN_ACTIVE',
    ]);
  });

  it('participant row가 없으면 current-user는 match summary를 조회하지 않고 season segment만 조합한다', async () => {
    const { service, currentSeasonParticipationViewOwner, matchesService } = createServiceTestKit();
    currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment.mockResolvedValueOnce(
      makeSeasonSegment({ participant: null }),
    );

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).not.toHaveBeenCalled();
    expect(result.match).toEqual({ hasActiveMatch: false, activeMatch: null });
  });

  it('onboarding service-intro row가 없으면 dismissed=false/null을 반환한다', async () => {
    const { service } = createServiceTestKit();

    const result = await service.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.onboarding.dismissedNotices).toEqual([
      {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissed: false,
        dismissedAt: null,
      },
    ]);
  });

  it('onboarding service-intro 상태는 season profile/registration segment와 독립이다', async () => {
    const { service, currentSeasonParticipationViewOwner } = createServiceTestKit();
    currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment.mockResolvedValueOnce(
      makeSeasonSegment({
        seasonProfile: {
          ...makeSeasonSegment().seasonProfile,
          registered: true,
          profileState: 'REGISTRATION_FINALIZED',
          draftWritable: false,
          canSelectDormitory: false,
          canFinalizeRegistration: false,
        },
        capabilities: {
          canCreateOrUpdateSeasonProfileDraft: false,
          canSelectDormitory: false,
          canFinalizeSeasonRegistration: false,
        },
      }),
    );

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

  it('current-user display identity는 season profile nickname snapshot과 섞지 않는다', async () => {
    const { service, currentSeasonParticipationViewOwner } = createServiceTestKit();
    currentSeasonParticipationViewOwner.buildCurrentUserSeasonParticipationSegment.mockResolvedValueOnce(
      makeSeasonSegment({
        participant: {
          id: 'participant-1',
          profile: {
            nicknameSnapshot: '시즌스냅샷',
            nicknameNormalizedSnapshot: '시즌스냅샷',
          },
        },
      }),
    );

    const result = await service.buildCurrentUserResponse(
      {
        ...makeUser(),
        displayIdentity: {
          ...makeUser().displayIdentity,
          nickname: '계정닉네임',
          nicknameNormalized: '계정닉네임',
        },
      },
      NOW,
    );

    expect(result.user.nickname).toBe('계정닉네임');
    expect(result.displayIdentity).toMatchObject({
      nickname: '계정닉네임',
      nicknameSource: 'USER_DISPLAY_IDENTITY',
    });
  });
});
