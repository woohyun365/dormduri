import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user';
import { UsersService } from './users.service.js';

type DismissedNoticeUpsertArgs = {
  where: { userId_noticeKey: { userId: string; noticeKey: string } };
  create: { userId: string; noticeKey: string; dismissedAt: Date };
  update: Record<string, never>;
};

const authUser = {
  id: 'user-1',
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
};

describe('UsersService facade boundary', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: { findUnique: jest.fn() },
    userDisplayIdentity: { findUnique: jest.fn(), updateMany: jest.fn() },
    userDisplayIdentityNicknameChangeEvent: { create: jest.fn(), findMany: jest.fn() },
    userAcademicIdentity: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
    userAcademicIdentityChangeAllowance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userAcademicIdentityChangeEvent: { create: jest.fn(), findMany: jest.fn() },
    seasonParticipantProfileHistory: { findFirst: jest.fn() },
    seasonParticipant: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    season: { findFirst: jest.fn() },
    seasonParticipantProfile: { updateMany: jest.fn() },
    userDismissedNotice: { upsert: jest.fn() },
    retentionCase: { findFirst: jest.fn(), create: jest.fn() },
    userPasswordCredential: { findUnique: jest.fn() },
    retainedIdentityHold: { create: jest.fn() },
    retainedIdentitySnapshot: { create: jest.fn() },
    authSession: { updateMany: jest.fn() },
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

  beforeEach(() => {
    jest.clearAllMocks();
    currentUserViewService.getCurrentUser.mockResolvedValue({ current: true });
    currentUserViewService.buildCurrentUserResponse.mockResolvedValue({ currentUser: true });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(prisma)),
    );
  });

  it('getCurrentUser는 CurrentUserViewService에 위임한다', async () => {
    await expect(service.getCurrentUser(authUser)).resolves.toEqual({ current: true });

    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(authUser);
  });

  it('updateCurrentUser는 no-op input도 owner cluster를 거쳐 current-user response를 readback한다', async () => {
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-05-23T00:00:00.000Z'));
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'student@kangwon.ac.kr',
      emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        userId: 'user-1',
        nickname: '기존닉네임',
        nicknameNormalized: '기존닉네임',
        nicknameChangedAt: null,
      },
      academicIdentity: {
        userId: 'user-1',
        collegeCode: 'ARTS_ENGINEERING',
        birthYear: 2002,
      },
      dismissedNotices: [],
    });

    await expect(service.updateCurrentUser(authUser, {})).resolves.toEqual({
      currentUser: { currentUser: true },
      mutation: {
        displayIdentity: { attempted: false, changed: false, noOpReason: null },
        academicIdentity: { attempted: false, changed: false, noOpReason: null },
      },
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(currentUserViewService.buildCurrentUserResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      new Date('2026-05-23T00:00:00.000Z'),
    );
  });

  it('dismissCurrentUserOnboardingNotice는 onboarding owner를 통해 current-user를 readback한다', async () => {
    prisma.userDismissedNotice.upsert.mockResolvedValue({ userId: 'user-1' });
    currentUserViewService.getCurrentUser.mockResolvedValue({ dismissed: true });

    await expect(
      service.dismissCurrentUserOnboardingNotice(authUser, { noticeKey: SERVICE_INTRO_NOTICE_KEY }),
    ).resolves.toEqual({ dismissed: true });

    const upsertMock = prisma.userDismissedNotice.upsert as jest.Mock<
      unknown,
      [DismissedNoticeUpsertArgs]
    >;
    const [upsertArgs] = upsertMock.mock.calls[0]!;
    expect(upsertArgs.where).toEqual({
      userId_noticeKey: { userId: 'user-1', noticeKey: SERVICE_INTRO_NOTICE_KEY },
    });
    expect(upsertArgs.create).toMatchObject({
      userId: 'user-1',
      noticeKey: SERVICE_INTRO_NOTICE_KEY,
    });
    expect(upsertArgs.create.dismissedAt).toBeInstanceOf(Date);
    expect(upsertArgs.update).toEqual({});
    expect(currentUserViewService.getCurrentUser).toHaveBeenCalledWith(authUser);
  });
});
