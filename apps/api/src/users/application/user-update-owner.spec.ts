import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserUpdateOwner } from './user-update-owner.js';
import { usersErrors } from '../errors/users.errors.js';

const authUser = {
  id: 'user-1',
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
};

const USER = {
  id: 'user-1',
  email: 'student@kangwon.ac.kr',
  emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
  deletedAt: null,
  gender: 'M' as const,
  campus: 'CHUNCHEON' as const,
  displayIdentity: {
    userId: 'user-1',
    nickname: '기존닉네임',
    nicknameNormalized: '기존닉네임',
    nicknameChangedAt: null,
  },
  academicIdentity: {
    userId: 'user-1',
    collegeCode: 'CHUNCHEON_IT',
    birthYear: 2002,
  },
  dismissedNotices: [],
};

describe('UserUpdateOwner', () => {
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: { findUnique: vi.fn() },
    userDisplayIdentity: { findUnique: vi.fn(), updateMany: vi.fn() },
    userDisplayIdentityNicknameChangeEvent: { create: vi.fn() },
    seasonParticipant: { findUnique: vi.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: vi.fn() };
  const moderationService = { validateNicknamePolicy: vi.fn() };
  const currentUserViewService = { buildCurrentUserResponse: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-05-21T00:00:00.000Z'));
    prisma.user.findUnique.mockResolvedValue(USER);
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(prisma)),
    );
    currentUserViewService.buildCurrentUserResponse.mockResolvedValue({ current: true });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    moderationService.validateNicknamePolicy.mockResolvedValue(null);
    prisma.userDisplayIdentity.findUnique.mockResolvedValue(null);
    prisma.userDisplayIdentity.updateMany.mockResolvedValue({ count: 1 });
    prisma.userDisplayIdentityNicknameChangeEvent.create.mockResolvedValue({ id: 'event-1' });
  });

  it('no-op input은 transaction 없이 current-user response만 readback한다', async () => {
    const owner = createUserUpdateOwner({
      prisma: prisma as never,
      seasonsService: seasonsService as never,
      moderationService: moderationService as never,
      currentUserViewService: currentUserViewService as never,
    });

    await expect(owner.updateCurrentUser(authUser, {})).resolves.toEqual({
      currentUser: { current: true },
      mutation: {
        displayIdentity: { attempted: false, changed: false, noOpReason: null },
        academicIdentity: { attempted: false, changed: false, noOpReason: null },
      },
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(currentUserViewService.buildCurrentUserResponse).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      new Date('2026-05-21T00:00:00.000Z'),
    );
  });

  it('deleted user는 transaction 내부에서 기존 account deleted error를 유지한다', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(USER)
      .mockResolvedValueOnce({ ...USER, deletedAt: new Date('2026-05-20T00:00:00.000Z') });
    const owner = createUserUpdateOwner({
      prisma: prisma as never,
      seasonsService: seasonsService as never,
      moderationService: moderationService as never,
      currentUserViewService: currentUserViewService as never,
    });

    await expect(
      owner.updateCurrentUser(authUser, { displayIdentity: { nickname: '새닉네임' } }),
    ).rejects.toMatchObject({
      response: usersErrors.accountAlreadyDeleted().getResponse(),
    });

    expect(prisma.userDisplayIdentity.updateMany).not.toHaveBeenCalled();
  });
});
