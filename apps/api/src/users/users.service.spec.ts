import { UsersService } from './users.service.js';
import { usersErrors } from './users.errors.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');

const currentSeasonContext = {
  season: { id: 'season-1' },
  state: 'SEASON_OPEN',
} as const;

function makeDisplayIdentity(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    nickname: '기존닉네임',
    nicknameNormalized: '기존닉네임',
    nicknameChangedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRegisteredParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-05-20T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-05-01T00:00:00.000Z'),
    activatedAt: new Date('2026-05-20T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    profile: null,
    ...overrides,
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'student@kangwon.ac.kr',
    emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
    gender: 'M',
    campus: 'CHUNCHEON',
    displayIdentity: makeDisplayIdentity(),
    dismissedNotices: [],
    ...overrides,
  };
}

type UserFindUniqueArgs = {
  where: { id: string };
  select: Record<string, unknown>;
};

type BuildCurrentUserResponseArgs = [ReturnType<typeof makeUser>, Date];

describe('UsersService current-user boundary', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    userDisplayIdentity: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    seasonParticipant: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    runSerializableTransaction: jest.fn(),
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const moderationService = {
    validateNicknamePolicy: jest.fn(),
  };
  const currentUserViewService = {
    getCurrentUser: jest.fn(),
    buildCurrentUserResponse: jest.fn(),
  };

  const service = new UsersService(
    prisma as never,
    seasonsService as never,
    moderationService as never,
    currentUserViewService as never,
  );

  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(NOW);
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.updateMany.mockResolvedValue({ count: 1 });
    prisma.seasonParticipant.findUnique.mockResolvedValue(null);
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(prisma)),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue(currentSeasonContext);
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    currentUserViewService.getCurrentUser.mockResolvedValue({ current: true });
    currentUserViewService.buildCurrentUserResponse.mockResolvedValue({ updated: true });
  });

  it('getCurrentUser는 CurrentUserViewService에 위임한다', async () => {
    await expect(service.getCurrentUser(authUser)).resolves.toEqual({ current: true });

    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(authUser);
  });

  it('updateCurrentUser는 display identity nickname만 수정한다', async () => {
    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '새닉네임' },
      }),
    ).resolves.toEqual({
      currentUser: { updated: true },
      mutation: {
        displayIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    const findUniqueMock = prisma.user.findUnique as jest.Mock<unknown, [UserFindUniqueArgs]>;
    const [findUniqueArgs] = findUniqueMock.mock.calls[0]!;
    expect(findUniqueArgs.where).toEqual({ id: 'user-1' });
    expect(findUniqueArgs.select).toHaveProperty('displayIdentity');
    expect(findUniqueArgs.select).toHaveProperty('dismissedNotices');
    expect(prisma.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        nicknameChangedAt: null,
      },
      data: {
        nickname: '새닉네임',
        nicknameNormalized: '새닉네임',
        nicknameChangedAt: NOW,
      },
    });
    const buildCurrentUserResponseMock =
      currentUserViewService.buildCurrentUserResponse as jest.Mock<
        unknown,
        BuildCurrentUserResponseArgs
      >;
    const [builtUser, builtAt] = buildCurrentUserResponseMock.mock.calls.at(-1)!;
    expect(builtUser.id).toBe('user-1');
    expect(builtUser.displayIdentity.nickname).toBe('기존닉네임');
    expect(builtAt).toBe(NOW);
  });

  it('display identity payload가 없으면 profile/selection write 없이 current-user 응답만 다시 만든다', async () => {
    await expect(service.updateCurrentUser(authUser, {})).resolves.toEqual({
      currentUser: { updated: true },
      mutation: {
        displayIdentity: {
          attempted: false,
          changed: false,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
    const buildCurrentUserResponseMock =
      currentUserViewService.buildCurrentUserResponse as jest.Mock<
        unknown,
        BuildCurrentUserResponseArgs
      >;
    const [builtUser, builtAt] = buildCurrentUserResponseMock.mock.calls[0]!;
    expect(builtUser.id).toBe('user-1');
    expect(builtAt).toBe(NOW);
  });

  it('현재 시즌 registration 완료 상태면 display identity nickname 변경을 거부한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '등록후변경' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameLockedBySeason().getResponse(),
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
  });

  it('current season이 없으면 season lock 없이 기존 nickname 정책대로 수정한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '비시즌변경' },
      }),
    ).resolves.toEqual({
      currentUser: { updated: true },
      mutation: {
        displayIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.seasonParticipant.findUnique).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        nicknameChangedAt: null,
      },
      data: {
        nickname: '비시즌변경',
        nicknameNormalized: '비시즌변경',
        nicknameChangedAt: NOW,
      },
    });
  });

  it('철회/거절 상태는 재등록 불가 상태이므로 season nickname lock 없이 기존 정책대로 수정한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      makeRegisteredParticipant({
        participationIntent: 'DECLINED',
        declinedAt: new Date('2026-05-22T00:00:00.000Z'),
        participantStatus: 'WITHDRAWN',
        withdrawnAt: new Date('2026-05-22T00:00:00.000Z'),
      }),
    );

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '철회후변경' },
      }),
    ).resolves.toEqual({
      currentUser: { updated: true },
      mutation: {
        displayIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        nicknameChangedAt: null,
      },
      data: {
        nickname: '철회후변경',
        nicknameNormalized: '철회후변경',
        nicknameChangedAt: NOW,
      },
    });
  });

  it('같은 nickname no-op은 season lock과 cooldown보다 먼저 idempotent 성공한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        displayIdentity: makeDisplayIdentity({
          nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
        }),
      }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '기존닉네임' },
      }),
    ).resolves.toEqual({
      currentUser: { updated: true },
      mutation: {
        displayIdentity: {
          attempted: true,
          changed: false,
          noOpReason: 'SAME_NICKNAME',
        },
      },
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
  });

  it('등록 lock과 cooldown이 함께 있으면 registration lock error를 우선 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        displayIdentity: makeDisplayIdentity({
          nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
        }),
      }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '등록쿨다운' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameLockedBySeason().getResponse(),
    });
  });

  it('닉네임 쿨다운이 활성화되어 있으면 display identity 수정을 거부한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        displayIdentity: makeDisplayIdentity({
          nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
        }),
      }),
    );

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '쿨다운닉네임' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameCooldownActive().getResponse(),
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });
});
