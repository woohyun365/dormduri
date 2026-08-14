import { describe, expect, it, vi } from 'vitest';
import { AuthOperationalCleanupRepository } from './auth-operational-cleanup.repository.js';

type TypedSqlLike = {
  sql: string;
  values: readonly unknown[];
};

describe('AuthOperationalCleanupRepository', () => {
  it('TypedSQL cleanup query를 clamp된 batch size로 순차 실행하고 삭제 count를 집계한다', async () => {
    const queryRawTyped = vi
      .fn<(arg0: TypedSqlLike) => Promise<Array<{ deletedCount: number }>>>()
      .mockResolvedValueOnce([{ deletedCount: 1 }])
      .mockResolvedValueOnce([{ deletedCount: 2 }])
      .mockResolvedValueOnce([{ deletedCount: 3 }])
      .mockResolvedValueOnce([{ deletedCount: 4 }])
      .mockResolvedValueOnce([{ deletedCount: 5 }]);
    const prisma = {
      $queryRawTyped: queryRawTyped as never,
    };
    const repository = new AuthOperationalCleanupRepository();
    const cutoff = new Date('2026-06-01T00:00:00.000Z');

    await expect(
      repository.pruneBatch(prisma, {
        expiredSessionCutoff: cutoff,
        verificationCodeCutoff: cutoff,
        verificationRequestLogCutoff: cutoff,
        loginAttemptCutoff: cutoff,
        securityEventCutoff: cutoff,
        batchSize: 5_000,
      }),
    ).resolves.toEqual({
      expiredSessions: 1,
      verificationCodes: 2,
      verificationRequestLogs: 3,
      loginAttempts: 4,
      securityEvents: 5,
    });

    expect(queryRawTyped).toHaveBeenCalledTimes(5);
    for (const [query] of queryRawTyped.mock.calls) {
      expect(query.values).toEqual(expect.arrayContaining([1000]));
    }
  });
});
