import { describe, expect, it, vi } from 'vitest';
import { AuthOperationalCleanupService } from './auth-operational-cleanup.service.js';

describe('AuthOperationalCleanupService', () => {
  const now = new Date('2026-06-03T00:00:00.000Z');
  const settings = {
    cleanupBatchSize: 10,
    expiredSessionRetentionDays: 30,
    verificationCodeRetentionDays: 7,
    verificationRequestLogRetentionDays: 30,
    loginAttemptRetentionDays: 30,
    securityEventRetentionDays: 90,
  };

  it('retention worker credential로 cutoff별 batch cleanup을 실행하고 포화된 target을 기록한다', async () => {
    const prisma = { getDatabaseNow: vi.fn().mockResolvedValue(now) };
    const repository = {
      pruneBatch: vi.fn().mockResolvedValue({
        expiredSessions: 10,
        verificationCodes: 0,
        verificationRequestLogs: 0,
        loginAttempts: 0,
        securityEvents: 0,
      }),
    };
    const metrics = {
      recordCleanup: vi.fn(),
      recordCleanupFailure: vi.fn(),
    };
    const service = new AuthOperationalCleanupService(
      prisma as never,
      repository,
      metrics as never,
      settings,
    );

    await expect(service.runCleanupBatch()).resolves.toMatchObject({
      expiredSessions: 10,
      batchSaturatedTargets: ['expiredSessions'],
      ranAt: now.toISOString(),
    });
    expect(repository.pruneBatch).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        expiredSessionCutoff: new Date('2026-05-04T00:00:00.000Z'),
        verificationCodeCutoff: new Date('2026-05-27T00:00:00.000Z'),
        verificationRequestLogCutoff: new Date('2026-05-04T00:00:00.000Z'),
        loginAttemptCutoff: new Date('2026-05-04T00:00:00.000Z'),
        securityEventCutoff: new Date('2026-03-05T00:00:00.000Z'),
        batchSize: 10,
      }),
    );
    expect(metrics.recordCleanup).toHaveBeenCalledWith({
      deletedCounts: {
        expiredSessions: 10,
        verificationCodes: 0,
        verificationRequestLogs: 0,
        loginAttempts: 0,
        securityEvents: 0,
      },
      batchSaturatedTargets: ['expiredSessions'],
      ranAt: now,
    });
  });

  it('여러 target의 합계가 batch size와 같아도 개별 target이 가득 차지 않으면 포화로 보지 않는다', async () => {
    const prisma = { getDatabaseNow: vi.fn().mockResolvedValue(now) };
    const repository = {
      pruneBatch: vi.fn().mockResolvedValue({
        expiredSessions: 2,
        verificationCodes: 2,
        verificationRequestLogs: 2,
        loginAttempts: 2,
        securityEvents: 2,
      }),
    };
    const metrics = {
      recordCleanup: vi.fn(),
      recordCleanupFailure: vi.fn(),
    };
    const service = new AuthOperationalCleanupService(
      prisma as never,
      repository,
      metrics as never,
      settings,
    );

    await expect(service.runCleanupBatch()).resolves.toMatchObject({
      batchSaturatedTargets: [],
    });
    expect(metrics.recordCleanup).toHaveBeenCalledWith(
      expect.objectContaining({ batchSaturatedTargets: [] }),
    );
  });

  it('cleanup 실패는 failure metric을 남기고 원본 오류를 전파한다', async () => {
    const error = new Error('worker role denied');
    const repository = {
      pruneBatch: vi.fn().mockRejectedValue(error),
    };
    const metrics = {
      recordCleanup: vi.fn(),
      recordCleanupFailure: vi.fn(),
    };
    const service = new AuthOperationalCleanupService(
      { getDatabaseNow: vi.fn().mockResolvedValue(now) } as never,
      repository,
      metrics as never,
      settings,
    );

    await expect(service.runCleanupBatch()).rejects.toBe(error);
    expect(metrics.recordCleanupFailure).toHaveBeenCalledWith({ now });
    expect(metrics.recordCleanup).not.toHaveBeenCalled();
  });
});
