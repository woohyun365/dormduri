import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVerificationChallengeRepository } from './auth-verification-challenge.repository.js';

describe('AuthVerificationChallengeRepository', () => {
  const txQueryRawTyped = vi.fn<(arg0: unknown) => Promise<unknown[]>>();
  const txVerificationCodeUpdateMany = vi.fn<(arg0: unknown) => Promise<{ count: number }>>();
  const prisma = {
    getDatabaseNow: vi.fn(),
    $queryRawTyped: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };
  const repository = new AuthVerificationChallengeRepository(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
    txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    txVerificationCodeUpdateMany.mockResolvedValue({ count: 1 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: txQueryRawTyped,
        verificationCode: { updateMany: txVerificationCodeUpdateMany },
      }),
    );
  });

  it('active verification record 조회 결과를 그대로 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([
      { id: 'code-1', codeHash: 'hash', failedAttempts: 2 },
    ]);

    await expect(repository.findActive('v1:subject', 'RESET_PASSWORD', 5)).resolves.toEqual({
      id: 'code-1',
      codeHash: 'hash',
      failedAttempts: 2,
    });
  });

  it('verify 성공은 advisory lock 아래 grant와 reset 대상 user를 함께 저장한다', async () => {
    await expect(
      repository.markVerifiedAndIssueGrant({
        id: 'code-1',
        subjectKey: 'v1:subject',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
        grantTokenHash: 'a'.repeat(64),
        grantTtlSeconds: 900,
        eligibleUserId: 'user-1',
      }),
    ).resolves.toBe(true);

    expect(txVerificationCodeUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'code-1',
        purpose: 'RESET_PASSWORD',
        subjectKey: 'v1:subject',
        verifiedAt: null,
        consumedAt: null,
        deliveryStatus: 'ACCEPTED',
        activatedAt: { not: null },
        codeExpiresAt: { gt: new Date('2026-04-23T00:00:00.000Z') },
        failedAttempts: { lt: 5 },
      },
      data: {
        verifiedAt: new Date('2026-04-23T00:00:00.000Z'),
        grantTokenHash: 'a'.repeat(64),
        grantExpiresAt: new Date('2026-04-23T00:15:00.000Z'),
        eligibleUserId: 'user-1',
      },
    });
  });

  it('failure 기록은 advisory lock과 TypedSQL 결과로 consume 여부를 반환한다', async () => {
    txQueryRawTyped
      .mockResolvedValueOnce([{ lockAcquired: null }])
      .mockResolvedValueOnce([
        { failedAttempts: 5, consumedAt: new Date('2026-04-23T00:00:00.000Z') },
      ]);

    await expect(
      repository.recordFailure({
        id: 'code-1',
        subjectKey: 'v1:subject',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
      }),
    ).resolves.toEqual({ recorded: true, consumed: true });
  });
});
