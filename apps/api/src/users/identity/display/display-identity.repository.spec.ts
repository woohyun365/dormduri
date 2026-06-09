import { Prisma } from '../../../generated/prisma/client.js';
import {
  assertNicknameAvailableForUser,
  updateDisplayIdentityNickname,
  type ParsedDisplayIdentityNickname,
} from './display-identity.repository.js';
import { usersErrors } from '../../errors/users.errors.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');
const DISPLAY_IDENTITY = {
  userId: 'user-1',
  nickname: '기존닉네임',
  nicknameNormalized: '기존닉네임',
  nicknameChangedAt: null,
  createdAt: new Date('2026-05-01T00:00:00.000Z'),
  updatedAt: new Date('2026-05-01T00:00:00.000Z'),
};
const PARSED_NICKNAME: ParsedDisplayIdentityNickname = {
  nickname: '새닉네임',
  nicknameNormalized: '새닉네임',
};

describe('display identity repository', () => {
  const client = {
    userDisplayIdentity: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('다른 user가 같은 normalized nickname을 쓰면 DISPLAY_NICKNAME_TAKEN으로 fail-closed 한다', async () => {
    client.userDisplayIdentity.findUnique.mockResolvedValue({ userId: 'other-user' });

    await expect(
      assertNicknameAvailableForUser(client as never, PARSED_NICKNAME, 'user-1'),
    ).rejects.toMatchObject({ response: usersErrors.nicknameAlreadyTaken().getResponse() });
  });

  it('stale nicknameChangedAt update race는 cooldown active error로 유지한다', async () => {
    client.userDisplayIdentity.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateDisplayIdentityNickname(client as never, {
        userId: 'user-1',
        displayIdentity: DISPLAY_IDENTITY,
        parsedNickname: PARSED_NICKNAME,
        now: NOW,
      }),
    ).rejects.toMatchObject({ response: usersErrors.nicknameCooldownActive().getResponse() });
  });

  it('unique index race P2002는 DISPLAY_NICKNAME_TAKEN으로 유지한다', async () => {
    client.userDisplayIdentity.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['nicknameNormalized'] },
      }),
    );

    await expect(
      updateDisplayIdentityNickname(client as never, {
        userId: 'user-1',
        displayIdentity: DISPLAY_IDENTITY,
        parsedNickname: PARSED_NICKNAME,
        now: NOW,
      }),
    ).rejects.toMatchObject({ response: usersErrors.nicknameAlreadyTaken().getResponse() });
  });
});
