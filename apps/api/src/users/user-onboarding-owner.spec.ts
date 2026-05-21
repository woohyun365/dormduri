import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user-contract';
import { CurrentUserViewService } from './current-user-view.service.js';
import { CurrentSeasonParticipationViewOwner } from '../season-participants/current-season-participation-view.owner.js';
import type { UserWithDisplayIdentityRecord } from './current-user-select.js';
import { createUserOnboardingOwner } from './user-onboarding-owner.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');
const AUTH_USER = {
  id: 'user-1',
  gender: 'M',
  campus: 'CHUNCHEON',
} as const;
const CURRENT_USER_RESPONSE = {
  ok: true,
} as unknown as CurrentUserResponse;

function makeUser(
  dismissedNotices: UserWithDisplayIdentityRecord['dismissedNotices'] = [],
): UserWithDisplayIdentityRecord {
  return {
    id: 'user-1',
    email: 'student@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
    gender: 'M',
    campus: 'CHUNCHEON',
    displayIdentity: {
      userId: 'user-1',
      nickname: '테스터',
      nicknameNormalized: '테스터',
      nicknameChangedAt: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    dismissedNotices,
  };
}

describe('createUserOnboardingOwner', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    userDismissedNotice: {
      upsert: jest.fn(),
    },
  };
  const currentUserViewService = {
    getCurrentUser: jest.fn(),
  };
  const owner = createUserOnboardingOwner({
    prisma: prisma as never,
    currentUserViewService: currentUserViewService as never,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(NOW);
    prisma.userDismissedNotice.upsert.mockResolvedValue({
      userId: AUTH_USER.id,
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
      dismissedAt: NOW,
    });
    currentUserViewService.getCurrentUser.mockResolvedValue(CURRENT_USER_RESPONSE);
  });

  it('service-intro notice를 userId+noticeKey compound key 기준으로 upsert한다', async () => {
    const result = await owner.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });

    expect(prisma.userDismissedNotice.upsert).toHaveBeenCalledWith({
      where: {
        userId_noticeKey: {
          userId: 'user-1',
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
        },
      },
      update: {},
      create: {
        userId: 'user-1',
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissedAt: NOW,
      },
    });
    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(AUTH_USER);
    expect(result).toBe(CURRENT_USER_RESPONSE);
  });

  it('같은 notice를 두 번 dismiss해도 동일 compound key upsert로 idempotent하게 처리한다', async () => {
    await owner.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
    await owner.dismissCurrentUserOnboardingNotice(AUTH_USER, {
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });

    expect(prisma.userDismissedNotice.upsert).toHaveBeenCalledTimes(2);
    const upsertCalls = prisma.userDismissedNotice.upsert.mock.calls as Array<[unknown]>;
    for (const [args] of upsertCalls) {
      expect(args).toMatchObject({
        where: {
          userId_noticeKey: {
            userId: 'user-1',
            noticeKey: SERVICE_INTRO_NOTICE_KEY,
          },
        },
        update: {},
      });
    }
  });

  it('지원하지 않는 noticeKey는 owner에서도 거부한다', async () => {
    await expect(
      owner.dismissCurrentUserOnboardingNotice(AUTH_USER, {
        noticeKey: 'unknown-notice',
      } as never),
    ).rejects.toMatchObject({ response: { code: 'INVALID_USER_PATCH' } });

    expect(prisma.userDismissedNotice.upsert).not.toHaveBeenCalled();
  });
});

describe('CurrentUserViewService onboarding read model', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    seasonParticipant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const seasonParticipantsService = {
    validateSeasonProfileCompleteness: jest.fn(() => ({ complete: false })),
    hasSelectableDormitoriesForCurrentParticipant: jest.fn(() => Promise.resolve(false)),
    hasValidDormitorySelectionForCurrentParticipant: jest.fn(() => Promise.resolve(false)),
    pickCurrentSeasonParticipant: jest.fn((items: unknown[]) => items[0] ?? null),
  };
  const matchesService = {
    getCurrentActiveMatchSummaryForParticipant: jest.fn(),
  };
  const currentSeasonParticipationViewOwner = new CurrentSeasonParticipationViewOwner(
    prisma as never,
    seasonParticipantsService as never,
  );
  const currentUserViewService = new CurrentUserViewService(
    prisma as never,
    seasonsService as never,
    currentSeasonParticipationViewOwner as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    prisma.seasonParticipant.findUnique.mockResolvedValue(null);
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    matchesService.getCurrentActiveMatchSummaryForParticipant.mockResolvedValue(null);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({
      complete: false,
    });
    seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant.mockResolvedValue(
      false,
    );
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      false,
    );
  });

  it('row가 없으면 service-intro dismissed=false/null을 반환한다', async () => {
    const result = await currentUserViewService.buildCurrentUserResponse(makeUser(), NOW);

    expect(result.onboarding.dismissedNotices).toEqual([
      {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
        dismissed: false,
        dismissedAt: null,
      },
    ]);
  });

  it('row가 있으면 season participant 상태와 무관하게 service-intro dismissed=true를 반환한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
    });
    prisma.seasonParticipant.findUnique.mockResolvedValue({
      id: 'participant-1',
      seasonId: 'season-1',
      userId: 'user-1',
      participationIntent: 'REGISTERED',
      registeredAt: new Date('2026-05-10T00:00:00.000Z'),
      declinedAt: null,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      hiddenByAdminAt: null,
      deactivatedAt: null,
      profile: {
        participantId: 'participant-1',
        nicknameSnapshot: '테스터',
        nicknameNormalizedSnapshot: '테스터',
        bedtime: 'BETWEEN_22_24',
        wakeTime: 'BETWEEN_07_08',
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
        intro: '소개',
        collegeCode: null,
        grade: null,
        mbti: null,
        birthYear: null,
        createdAt: new Date('2026-05-10T00:00:00.000Z'),
        updatedAt: new Date('2026-05-10T00:00:00.000Z'),
      },
    });

    const result = await currentUserViewService.buildCurrentUserResponse(
      makeUser([
        {
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissedAt: new Date('2026-05-20T00:00:00.000Z'),
        },
      ]),
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
