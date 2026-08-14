import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVerificationGrant, hashVerificationGrant } from './auth-verification-grant.js';
import { AuthVerificationGrantRepository } from './auth-verification-grant.repository.js';

describe('AuthVerificationGrantRepository', () => {
  const prisma = {
    getDatabaseNow: vi.fn(),
    verificationCode: { findUnique: vi.fn() },
  };
  const repository = new AuthVerificationGrantRepository(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
  });

  it('grant hash를 constant-time 비교하고 purpose와 만료를 검증한다', async () => {
    const grant = createVerificationGrant('code-1');
    prisma.verificationCode.findUnique.mockResolvedValue({
      id: 'code-1',
      subjectKey: 'v1:subject',
      purpose: 'SIGNUP',
      eligibleUserId: null,
      grantTokenHash: hashVerificationGrant(grant),
      grantExpiresAt: new Date('2026-04-23T00:15:00.000Z'),
      verifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      consumedAt: null,
    });

    await expect(repository.resolve(grant, 'SIGNUP')).resolves.toMatchObject({
      id: 'code-1',
      subjectKey: 'v1:subject',
      purpose: 'SIGNUP',
      tokenHash: hashVerificationGrant(grant),
    });
    await expect(repository.resolve(grant, 'RESET_PASSWORD')).resolves.toBeNull();
    await expect(
      repository.resolve(createVerificationGrant('code-1'), 'SIGNUP'),
    ).resolves.toBeNull();
  });
});
