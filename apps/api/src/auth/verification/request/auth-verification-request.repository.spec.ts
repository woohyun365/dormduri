import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVerificationRequestRepository } from './auth-verification-request.repository.js';

describe('AuthVerificationRequestRepository', () => {
  const prisma = {
    $queryRawTyped: vi.fn(),
  };
  const repository = new AuthVerificationRequestRepository(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('IP cooldown row가 있으면 retryAfterSeconds를 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ retryAfterSeconds: 42 }]);

    await expect(
      repository.findRetryAfterSeconds('v1:subject', 'SIGNUP', 'v1:request-ip', 600),
    ).resolves.toBe(42);
  });

  it('backstop 제한 미도달이면 null을 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ requestCount: 1, oldestRequestAt: new Date() }]);

    await expect(
      repository.findBackstopRetryAfterSeconds('v1:subject', 'SIGNUP', 600, 5),
    ).resolves.toBeNull();
  });

  it('backstop 제한 도달이면 oldestRequestAt 기준 retryAfterSeconds를 계산한다', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-23T00:00:00.000Z').getTime());
    prisma.$queryRawTyped.mockResolvedValue([
      {
        requestCount: 5,
        oldestRequestAt: new Date('2026-04-22T23:55:30.000Z'),
      },
    ]);

    await expect(
      repository.findBackstopRetryAfterSeconds('v1:subject', 'SIGNUP', 600, 5),
    ).resolves.toBe(330);
  });
});
