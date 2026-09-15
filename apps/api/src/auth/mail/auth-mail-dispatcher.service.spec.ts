import { describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { SesEmailSenderError } from '../adapters/email/ses-email-error.js';
import { AuthMailDispatcherService } from './auth-mail-dispatcher.service.js';

const now = new Date('2026-07-30T00:00:00.000Z');
const event = {
  id: 'mail-1',
  mailKind: 'PASSWORD_RESET_VERIFICATION',
  verificationCodeId: 'code-1',
  targetUserId: 'user-1',
  purpose: 'RESET_PASSWORD',
  payloadCiphertext: new Uint8Array([1]),
  payloadIv: new Uint8Array([2]),
  payloadAuthTag: new Uint8Array([3]),
  keyVersion: 'test-v1',
  createdAt: new Date('2026-07-29T23:59:48.000Z'),
  expiresAt: new Date('2026-07-30T00:10:00.000Z'),
  attemptCount: 1,
} as const;

function createFixture(mailSendTimeoutMs = 20, mailDispatcherEnabled = false) {
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
  };
  const envelopeReader = {
    decrypt: vi.fn().mockReturnValue({
      schemaVersion: 1,
      mailKind: 'PASSWORD_RESET_VERIFICATION',
      email: 'student@kangwon.ac.kr',
      code: '123456',
      expiresInSeconds: 600,
    }),
  };
  const repository = {
    expirePayloads: vi.fn().mockResolvedValue(0),
    claimBatch: vi.fn().mockResolvedValue([event]),
    markAccepted: vi.fn().mockResolvedValue(true),
    markDeliveryFailure: vi.fn().mockResolvedValue(undefined),
    markSuperseded: vi.fn().mockResolvedValue(undefined),
  };
  const emailSender = {
    sendVerificationCode: vi.fn(),
    sendPasswordResetCode: vi.fn().mockResolvedValue({ providerMessageId: 'ses-1' }),
    sendPasswordChanged: vi.fn(),
  };
  const settings = {
    mailDispatcherEnabled,
    mailDispatcherIntervalMs: 1_000,
    mailDispatcherBatchSize: 20,
    mailDispatcherClaimLeaseMs: 30_000,
    mailSendTimeoutMs,
  };
  const metrics = {
    recordDispatch: vi.fn(),
    recordOutboxLag: vi.fn(),
  };
  const service = new AuthMailDispatcherService(
    prisma as never,
    envelopeReader as never,
    repository as never,
    emailSender,
    settings as never,
    metrics,
  );
  return { service, prisma, repository, emailSender, metrics };
}

describe('AuthMailDispatcherService', () => {
  it.each([true, false])(
    'enabled=%s에 따라 timer를 등록하고 destroy 뒤에는 실행하지 않는다',
    async (enabled) => {
      vi.useFakeTimers();
      const { service, prisma, repository } = createFixture(1_000, enabled);
      repository.claimBatch.mockResolvedValue([]);
      try {
        service.onApplicationBootstrap();
        expect(vi.getTimerCount()).toBe(enabled ? 1 : 0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(repository.claimBatch).toHaveBeenCalledTimes(enabled ? 1 : 0);
        service.onModuleDestroy();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(enabled ? 1 : 0);
      } finally {
        service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );

  it.each(['clock', 'expire', 'claim'] as const)(
    '%s 초기 실패 뒤 다음 timer tick은 mail을 처리한다',
    async (failurePoint) => {
      vi.useFakeTimers();
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { service, prisma, repository, emailSender } = createFixture(1_000, true);
      const error = new Error(`${failurePoint} unavailable`);
      if (failurePoint === 'clock') prisma.getDatabaseNow.mockRejectedValueOnce(error);
      else if (failurePoint === 'expire') repository.expirePayloads.mockRejectedValueOnce(error);
      else repository.claimBatch.mockRejectedValueOnce(error);
      try {
        service.onApplicationBootstrap();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(warn).toHaveBeenCalledOnce();
        expect(repository.claimBatch).toHaveBeenCalledTimes(failurePoint === 'claim' ? 1 : 0);
        expect(emailSender.sendPasswordResetCode).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(2);
        expect(repository.claimBatch).toHaveBeenCalledTimes(failurePoint === 'claim' ? 2 : 1);
        expect(emailSender.sendPasswordResetCode).toHaveBeenCalledOnce();
        expect(repository.markAccepted).toHaveBeenCalledOnce();
        expect(repository.markDeliveryFailure).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
      } finally {
        service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        warn.mockRestore();
      }
    },
  );

  it('provider acceptance receipt 뒤에만 candidate를 활성화한다', async () => {
    const { service, repository, emailSender, metrics } = createFixture(1_000);

    await expect(service.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 1,
      acceptedCount: 1,
      failedCount: 0,
      unknownCount: 0,
      supersededCount: 0,
    });
    expect(emailSender.sendPasswordResetCode).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'mail-1' }),
    );
    expect(repository.markAccepted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerMessageId: 'ses-1' }),
    );
    expect(metrics.recordOutboxLag).toHaveBeenCalledWith(12);
    expect(metrics.recordDispatch).toHaveBeenCalledWith('accepted');
  });

  it('claimed batch에서 가장 오래된 mail의 lag을 owner-local gauge로 한 번 기록한다', async () => {
    const { service, repository, metrics } = createFixture(1_000);
    repository.claimBatch.mockResolvedValue([
      event,
      {
        ...event,
        id: 'mail-older',
        createdAt: new Date('2026-07-29T23:59:30.000Z'),
      },
    ]);

    await service.dispatchOnce(now);

    expect(metrics.recordOutboxLag).toHaveBeenCalledOnce();
    expect(metrics.recordOutboxLag).toHaveBeenCalledWith(30);
  });

  it('provider timeout은 UNKNOWN으로 종료하고 동일 payload를 재시도 상태로 돌리지 않는다', async () => {
    const { service, repository, emailSender } = createFixture();
    emailSender.sendPasswordResetCode.mockReturnValue(new Promise(() => undefined));

    const result = await service.dispatchOnce(now);

    expect(result.unknownCount).toBe(1);
    expect(repository.markDeliveryFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'UNKNOWN', providerErrorCategory: 'TIMEOUT' }),
    );
  });

  it('provider의 definitive rejection은 FAILED로 종료한다', async () => {
    const { service, repository, emailSender } = createFixture();
    emailSender.sendPasswordResetCode.mockRejectedValue(
      new SesEmailSenderError('MESSAGE_REJECTED'),
    );

    const result = await service.dispatchOnce(now);

    expect(result.failedCount).toBe(1);
    expect(repository.markDeliveryFailure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'FAILED' }),
    );
  });

  it('동일 process의 overlapping tick은 두 번째 claim을 시작하지 않는다', async () => {
    vi.useFakeTimers();
    const { service, repository, emailSender } = createFixture(1_000);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    emailSender.sendPasswordResetCode.mockImplementationOnce(async () => {
      await pending;
      return { providerMessageId: 'ses-1' };
    });

    const first = service.dispatchOnce(now);
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(emailSender.sendPasswordResetCode).toHaveBeenCalledOnce();
      await expect(service.dispatchOnce(now)).resolves.toEqual({
        claimedCount: 0,
        acceptedCount: 0,
        failedCount: 0,
        unknownCount: 0,
        supersededCount: 0,
      });
      expect(repository.claimBatch).toHaveBeenCalledOnce();
      release();
      await expect(first).resolves.toMatchObject({ acceptedCount: 1 });
      await expect(service.dispatchOnce(now)).resolves.toMatchObject({ acceptedCount: 1 });
      expect(repository.claimBatch).toHaveBeenCalledTimes(2);
    } finally {
      release();
      await Promise.allSettled([first]);
      service.onModuleDestroy();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
