import { UsersService } from './users.service.js';
import { usersErrors } from './users.errors.js';

const NOW = new Date('2026-05-23T00:00:00.000Z');

const currentSeasonContext = {
  season: { id: 'season-1', academicYear: 2026 },
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

function makeAcademicIdentity(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    collegeCode: 'ARTS_ENGINEERING',
    birthYear: 2002,
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
    academicIdentity: makeAcademicIdentity(),
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
    userDisplayIdentityNicknameChangeEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    userAcademicIdentity: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userAcademicIdentityChangeAllowance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userAcademicIdentityChangeEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    seasonParticipantProfileHistory: {
      findFirst: jest.fn(),
    },
    seasonParticipant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    seasonParticipantProfile: {
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
    prisma.userDisplayIdentityNicknameChangeEvent.create.mockResolvedValue({
      id: 'nickname-change-event-1',
    });
    prisma.userDisplayIdentityNicknameChangeEvent.findMany.mockResolvedValue([]);
    prisma.userAcademicIdentity.upsert.mockResolvedValue({
      userId: 'user-1',
      collegeCode: 'ARTS_ENGINEERING',
      birthYear: 2002,
    });
    prisma.userAcademicIdentity.findUnique.mockResolvedValue(makeAcademicIdentity());
    prisma.userAcademicIdentity.updateMany.mockResolvedValue({ count: 1 });
    prisma.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      userId: 'user-1',
      academicYear: 2026,
      collegeChangeRemaining: 1,
    });
    prisma.userAcademicIdentityChangeAllowance.upsert.mockResolvedValue({
      userId: 'user-1',
      academicYear: 2026,
      collegeChangeRemaining: 1,
      resetReason: 'ACADEMIC_CYCLE_ROLLOVER',
    });
    prisma.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 1 });
    prisma.userAcademicIdentityChangeEvent.create.mockResolvedValue({
      id: 'academic-identity-change-event-1',
    });
    prisma.userAcademicIdentityChangeEvent.findMany.mockResolvedValue([]);
    prisma.seasonParticipantProfileHistory.findFirst.mockResolvedValue(null);
    prisma.seasonParticipant.findUnique.mockResolvedValue(null);
    prisma.seasonParticipant.findMany.mockResolvedValue([{ id: 'participant-1' }]);
    prisma.seasonParticipant.updateMany.mockResolvedValue({ count: 0 });
    prisma.seasonParticipantProfile.updateMany.mockResolvedValue({ count: 0 });
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
        academicIdentity: {
          attempted: false,
          changed: false,
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
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        retainedIdentityId: null,
        source: 'USER_SELF',
        reason: 'USER_REQUEST',
        actorType: 'USER',
        actorId: 'user-1',
        previousNickname: '기존닉네임',
        previousNicknameNormalized: '기존닉네임',
        nextNickname: '새닉네임',
        nextNicknameNormalized: '새닉네임',
        seasonId: null,
        participantId: null,
        seasonProfileSnapshotUpdated: false,
        reportId: null,
        moderationCaseId: null,
        sanctionId: null,
        approvalReference: null,
        changedAt: NOW,
      },
      select: { id: true },
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
        academicIdentity: {
          attempted: false,
          changed: false,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
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

  it('현재 시즌 registration 완료 상태면 display identity nickname 변경은 registration snapshot lock으로 거부한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '등록후변경' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameLockedBySeason().getResponse(),
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
  });

  it('registration 완료 이후 regular user academic identity 변경은 registration snapshot lock으로 거부한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      } as never),
    ).rejects.toMatchObject({
      response: usersErrors.academicIdentityLockedByRegistration().getResponse(),
    });

    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('첫 registration snapshot 이후 birthYear 변경은 current season이 없어도 self-service에서 거부한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    prisma.seasonParticipantProfileHistory.findFirst.mockResolvedValue({
      id: 'history-1',
      userId: 'user-1',
      source: 'SEASON_REGISTRATION',
    });

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'ARTS_ENGINEERING',
          birthYear: 2001,
        },
      } as never),
    ).rejects.toMatchObject({
      response: usersErrors.academicBirthYearLockedAfterRegistration().getResponse(),
    });

    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('college correction allowance를 모두 사용하면 registration 전이어도 college 변경을 거부한다', async () => {
    prisma.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      userId: 'user-1',
      academicYear: 2026,
      collegeChangeRemaining: 0,
    });

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
    ).rejects.toMatchObject({
      response: usersErrors.academicCollegeChangeAllowanceExhausted().getResponse(),
    });

    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('이전 academic cycle allowance row는 요청 transaction 안에서 lazy rollover 후 원자 차감한다', async () => {
    prisma.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue({
      userId: 'user-1',
      academicYear: 2025,
      collegeChangeRemaining: 0,
    });

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userAcademicIdentityChangeAllowance.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'ACADEMIC_CYCLE_ROLLOVER',
      },
      update: {
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'ACADEMIC_CYCLE_ROLLOVER',
      },
    });
    expect(prisma.userAcademicIdentityChangeAllowance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: { gt: 0 },
      },
      data: {
        collegeChangeRemaining: { decrement: 1 },
      },
    });
    expect(prisma.userAcademicIdentityChangeEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        retainedIdentityId: null,
        source: 'USER_SELF',
        reason: 'ACADEMIC_CYCLE_ALLOWANCE',
        actorType: 'USER',
        actorId: 'user-1',
        previousCollegeCode: 'ARTS_ENGINEERING',
        nextCollegeCode: 'NURSING',
        previousBirthYear: 2002,
        nextBirthYear: 2002,
        seasonId: null,
        participantId: null,
        reportId: null,
        moderationCaseId: null,
        sanctionId: null,
        approvalReference: null,
        changedAt: NOW,
      },
      select: { id: true },
    });
  });

  it('allowance row가 없으면 signup invariant가 아니라 current cycle row를 lazy create 후 차감한다', async () => {
    prisma.userAcademicIdentityChangeAllowance.findUnique.mockResolvedValue(null);

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userAcademicIdentityChangeAllowance.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      },
      update: {
        academicYear: 2026,
        collegeChangeRemaining: 1,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      },
    });
    expect(prisma.userAcademicIdentityChangeAllowance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: { gt: 0 },
      },
      data: {
        collegeChangeRemaining: { decrement: 1 },
      },
    });
  });

  it('allowance atomic decrement race에서 count=0이면 academic identity 변경을 만들지 않고 exhausted로 fail-closed한다', async () => {
    prisma.userAcademicIdentityChangeAllowance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
    ).rejects.toMatchObject({
      response: usersErrors.academicCollegeChangeAllowanceExhausted().getResponse(),
    });

    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentityChangeEvent.create).not.toHaveBeenCalled();
  });

  it('academic correction cycle을 산출할 수 없으면 calendar fallback 없이 fail-closed한다', async () => {
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-without-academic-year' },
      state: 'SEASON_OPEN',
    });

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
    ).rejects.toMatchObject({
      response: usersErrors.academicCorrectionCycleUnavailable().getResponse(),
    });

    expect(prisma.userAcademicIdentityChangeAllowance.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentityChangeAllowance.updateMany).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
  });

  it('registration 전 academic identity 정정은 academic correction policy로 nickname cooldown과 독립된 mutation metadata를 반환한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        displayIdentity: makeDisplayIdentity({
          nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
        }),
      }),
    );

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userAcademicIdentity.upsert).toHaveBeenCalled();
    expect(prisma.userAcademicIdentityChangeEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        retainedIdentityId: null,
        source: 'USER_SELF',
        reason: 'USER_CORRECTION',
        actorType: 'USER',
        actorId: 'user-1',
        previousCollegeCode: 'ARTS_ENGINEERING',
        nextCollegeCode: 'NURSING',
        previousBirthYear: 2002,
        nextBirthYear: 2001,
        seasonId: null,
        participantId: null,
        reportId: null,
        moderationCaseId: null,
        sanctionId: null,
        approvalReference: null,
        changedAt: NOW,
      },
      select: { id: true },
    });
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('같은 academic identity no-op은 registration snapshot lock보다 먼저 idempotent 성공한다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'ARTS_ENGINEERING',
          birthYear: 2002,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: false,
          noOpReason: 'SAME_ACADEMIC_IDENTITY',
        },
      },
    });

    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentityChangeEvent.create).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('current registration이 없으면 snapshot lock 없이 academic correction allowance policy를 적용한다', async () => {
    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userAcademicIdentityChangeAllowance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: { gt: 0 },
      },
      data: {
        collegeChangeRemaining: { decrement: 1 },
      },
    });
    expect(prisma.userAcademicIdentity.upsert).toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('철회/거절 상태는 current registration snapshot lock 없이 academic identity correction policy를 적용한다', async () => {
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
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      } as never),
    ).resolves.toMatchObject({
      mutation: {
        academicIdentity: {
          attempted: true,
          changed: true,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userAcademicIdentityChangeAllowance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        academicYear: 2026,
        collegeChangeRemaining: { gt: 0 },
      },
      data: {
        collegeChangeRemaining: { decrement: 1 },
      },
    });
    expect(prisma.userAcademicIdentity.upsert).toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('deleted/deidentified account는 academic identity self-service mutation을 fail-closed한다', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      }),
    );

    await expect(
      service.updateCurrentUser(authUser, {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2001,
        },
      } as never),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_ALREADY_DELETED' },
    });

    expect(prisma.userAcademicIdentity.upsert).not.toHaveBeenCalled();
    expect(prisma.userAcademicIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });

  it('current season이 없으면 registration snapshot lock 없이 기존 nickname 정책대로 수정한다', async () => {
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
        academicIdentity: {
          attempted: false,
          changed: false,
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

  it('철회/거절 상태는 재등록 불가 상태이므로 registration snapshot lock 없이 기존 nickname 정책대로 수정한다', async () => {
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
        academicIdentity: {
          attempted: false,
          changed: false,
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

  it('같은 nickname no-op은 registration snapshot lock과 cooldown보다 먼저 idempotent 성공한다', async () => {
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
        academicIdentity: {
          attempted: false,
          changed: false,
          noOpReason: null,
        },
      },
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
    expect(moderationService.validateNicknamePolicy).not.toHaveBeenCalled();
  });

  it('registration snapshot lock과 cooldown이 함께 있으면 snapshot lock error를 우선 반환한다', async () => {
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

  it('retention/de-identification 표시용 reserved nickname은 사용자 변경에서 거부한다', async () => {
    moderationService.validateNicknamePolicy.mockResolvedValue(
      '사용할 수 없는 단어가 포함되어 있습니다.',
    );

    await expect(
      service.updateCurrentUser(authUser, {
        displayIdentity: { nickname: '탈퇴한사용자' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors
        .nicknameModerationRejected('사용할 수 없는 단어가 포함되어 있습니다.')
        .getResponse(),
    });

    expect(moderationService.validateNicknamePolicy).toHaveBeenCalledWith('탈퇴한사용자');
    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).not.toHaveBeenCalled();
  });

  it('policy enforcement override base는 registration snapshot lock과 cooldown을 우회하지만 unique/format invariants는 유지한다', async () => {
    prisma.seasonParticipantProfile.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        displayIdentity: makeDisplayIdentity({
          nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
        }),
      }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValue(makeRegisteredParticipant());

    await expect(
      service.overrideDisplayIdentityNicknameForPolicyEnforcement({
        userId: 'user-1',
        nickname: '임시닉네임',
        actorId: 'ops-1',
        reason: 'ENFORCEMENT_ACTION',
      }),
    ).resolves.toMatchObject({
      userId: 'user-1',
      nickname: '임시닉네임',
      nicknameNormalized: '임시닉네임',
      override: { actorId: 'ops-1', reason: 'ENFORCEMENT_ACTION' },
    });

    expect(prisma.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        nicknameChangedAt: new Date('2026-05-22T23:59:00.000Z'),
      },
      data: {
        nickname: '임시닉네임',
        nicknameNormalized: '임시닉네임',
        nicknameChangedAt: NOW,
      },
    });
    expect(prisma.seasonParticipantProfile.updateMany).toHaveBeenCalledWith({
      where: { participantId: 'participant-1' },
      data: {
        nicknameSnapshot: '임시닉네임',
        nicknameNormalizedSnapshot: '임시닉네임',
      },
    });
    expect(prisma.userDisplayIdentityNicknameChangeEvent.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        retainedIdentityId: null,
        source: 'POLICY_ENFORCEMENT',
        reason: 'ENFORCEMENT_ACTION',
        actorType: 'ADMIN',
        actorId: 'ops-1',
        previousNickname: '기존닉네임',
        previousNicknameNormalized: '기존닉네임',
        nextNickname: '임시닉네임',
        nextNicknameNormalized: '임시닉네임',
        seasonId: 'season-1',
        participantId: 'participant-1',
        seasonProfileSnapshotUpdated: true,
        reportId: null,
        moderationCaseId: null,
        sanctionId: null,
        approvalReference: null,
        changedAt: NOW,
      },
      select: { id: true },
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
