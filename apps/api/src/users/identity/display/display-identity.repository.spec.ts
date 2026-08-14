import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import {
  DisplayIdentityRepository,
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
  ok: true,
  value: '새닉네임',
  normalized: '새닉네임',
  script: 'HANGUL',
};

describe('display identity repository', () => {
  const client = {
    userDisplayIdentity: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('typed repository는 normalized nickname owner만 반환한다', async () => {
    client.userDisplayIdentity.findUnique.mockResolvedValue({ userId: 'owner-1' });
    const repository = new DisplayIdentityRepository(client as never);

    await expect(repository.findNicknameOwner('niceguy')).resolves.toBe('owner-1');
    expect(client.userDisplayIdentity.findUnique).toHaveBeenCalledWith({
      where: { nicknameNormalized: 'niceguy' },
      select: { userId: true },
    });
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
