import { describe, expect, it, vi } from 'vitest';
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
  expiresAt: new Date('2026-07-30T00:10:00.000Z'),
  attemptCount: 1,
} as const;

function createFixture(mailSendTimeoutMs = 20) {
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
    mailDispatcherEnabled: false,
    mailDispatcherIntervalMs: 1_000,
    mailDispatcherBatchSize: 20,
    mailDispatcherClaimLeaseMs: 30_000,
    mailSendTimeoutMs,
  };
  const service = new AuthMailDispatcherService(
    prisma as never,
    envelopeReader as never,
    repository as never,
    emailSender,
    settings as never,
  );
  return { service, repository, emailSender };
}

describe('AuthMailDispatcherService', () => {
  it('provider acceptance receipt 뒤에만 candidate를 활성화한다', async () => {
    const { service, repository, emailSender } = createFixture(1_000);

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
    const { service, repository, emailSender } = createFixture(1_000);
    let resolveSend: ((value: { providerMessageId: string | null }) => void) | undefined;
    emailSender.sendPasswordResetCode.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );

    const first = service.dispatchOnce(now);
    await vi.waitFor(() => expect(emailSender.sendPasswordResetCode).toHaveBeenCalledOnce());
    await expect(service.dispatchOnce(now)).resolves.toEqual({
      claimedCount: 0,
      acceptedCount: 0,
      failedCount: 0,
      unknownCount: 0,
      supersededCount: 0,
    });
    resolveSend?.({ providerMessageId: 'ses-1' });
    await first;
    expect(repository.claimBatch).toHaveBeenCalledOnce();
  });
});
