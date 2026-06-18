import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVerificationEligibilityQuery } from './auth-verification-eligibility.query.js';

describe('AuthVerificationEligibilityQuery', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const query = new AuthVerificationEligibilityQuery(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signup code eligibility는 user 존재 여부만 조회한다', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(query.signupUserExists('test@kangwon.ac.kr')).resolves.toBe(true);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { emailNormalized: 'test@kangwon.ac.kr' },
      select: { id: true },
    });
  });

  it.each([
    ['missing user', null, false],
    [
      'deleted user',
      {
        id: 'user-deleted',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
        emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
      false,
    ],
    [
      'unverified user',
      {
        id: 'user-unverified',
        deletedAt: null,
        emailVerifiedAt: null,
      },
      false,
    ],
    [
      'active verified user',
      {
        id: 'user-verified',
        deletedAt: null,
        emailVerifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      },
      true,
    ],
  ])('password reset eligibility는 %s 상태를 %s로 평가한다', async (_label, user, expected) => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(query.passwordResetEligible('test@kangwon.ac.kr')).resolves.toBe(expected);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { emailNormalized: 'test@kangwon.ac.kr' },
      select: { id: true, deletedAt: true, emailVerifiedAt: true },
    });
  });
});
