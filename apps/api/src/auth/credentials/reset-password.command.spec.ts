import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hash as argonHash } from '@node-rs/argon2';
import { resetPassword } from './reset-password.command.js';
import type { AuthSecurityEventInput } from '../security-events/auth-security-event.types.js';

const hashPasswordForTest = (password: string) =>
  argonHash(password, {
    algorithm: 2,
    memoryCost: 8192,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

describe('resetPassword command', () => {
  const databaseNow = new Date('2026-04-23T00:00:00.000Z');
  const verificationGrant = `v1.code-1.${'g'.repeat(43)}`;
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authSession: {
      updateMany: vi.fn(),
    },
    loginAttempt: {
      deleteMany: vi.fn(),
    },
    verificationCode: {
      updateMany: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
  };
  const verificationService = {
    resolveVerificationGrant: vi.fn(),
  };
  const loginAttemptService = {
    clearFailuresInTransaction: vi.fn(),
  };
  const securityEvents = {
    recordSafely: vi
      .fn<(arg0: AuthSecurityEventInput) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const transactionSecurityEventCreate = vi.fn();
  const deps = { prisma, verificationService, loginAttemptService, securityEvents };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.user.update.mockResolvedValue(undefined);
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.$queryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: prisma.$queryRawTyped,
        user: { update: prisma.user.update },
        authSession: { updateMany: prisma.authSession.updateMany },
        loginAttempt: { deleteMany: prisma.loginAttempt.deleteMany },
        verificationCode: { updateMany: prisma.verificationCode.updateMany },
        authSecurityEvent: { create: transactionSecurityEventCreate },
      }),
    );
  });

  it('유효한 reset grant가 없으면 user 조회와 password hash 작업 전에 중단한다', async () => {
    verificationService.resolveVerificationGrant.mockResolvedValue(null);

    await expect(resetPassword(deps as never, null, 'NewPass1234')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('verified proof consume, password update, session revoke를 serializable transaction으로 처리한다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailNormalized: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
      emailVerifiedAt: databaseNow,
    });
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'RESET_PASSWORD',
      eligibleUserId: 'user-1',
      tokenHash: 'a'.repeat(64),
    });

    await expect(
      resetPassword(deps as never, verificationGrant, 'NewPass1234', {
        requestIp: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toEqual({ success: true });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    expect(prisma.verificationCode.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'code-1',
        purpose: 'RESET_PASSWORD',
        grantTokenHash: 'a'.repeat(64),
        verifiedAt: { not: null },
        grantExpiresAt: { gt: databaseNow },
        consumedAt: null,
      },
      data: { consumedAt: databaseNow },
    });
    const updateUserCalls = prisma.user.update.mock.calls as unknown as Array<
      [{ where: { id: string }; data: { passwordHash: unknown } }]
    >;
    const updateUserCall = updateUserCalls[0]?.[0];
    expect(updateUserCall?.where).toEqual({ id: 'user-1' });
    expect(typeof updateUserCall?.data.passwordHash).toBe('string');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: databaseNow },
    });
    expect(loginAttemptService.clearFailuresInTransaction).toHaveBeenCalledTimes(1);
    const clearFailureCalls = loginAttemptService.clearFailuresInTransaction.mock
      .calls as unknown as Array<[{ loginAttempt: { deleteMany: unknown } }, string]>;
    const clearFailureCall = clearFailureCalls[0];
    expect(clearFailureCall?.[0].loginAttempt.deleteMany).toBe(prisma.loginAttempt.deleteMany);
    expect(clearFailureCall?.[1]).toBe('test@kangwon.ac.kr');
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SESSION_REVOKE_ALL',
        targetUserId: 'user-1',
        emailNormalized: 'test@kangwon.ac.kr',
        requestIp: '127.0.0.1',
        userAgent: 'jest',
        metadata: { reason: 'reset_password', revokedCount: 1 },
      }),
    );
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET_PASSWORD_CONSUMED',
        targetUserId: 'user-1',
        emailNormalized: 'test@kangwon.ac.kr',
        metadata: { loginAttemptState: 'cleared' },
      }),
    );
  });

  it.fails('credential 변경 감사 이력은 password transaction과 함께 commit된다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailNormalized: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
      emailVerifiedAt: databaseNow,
    });
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'RESET_PASSWORD',
      eligibleUserId: 'user-1',
      tokenHash: 'a'.repeat(64),
    });

    await resetPassword(deps as never, verificationGrant, 'NewPass1234');

    const auditCalls = transactionSecurityEventCreate.mock.calls as unknown as Array<
      [{ data: { type: string; targetUserId: string } }]
    >;
    expect(auditCalls.map(([input]) => input.data)).toContainEqual(
      expect.objectContaining({
        type: 'RESET_PASSWORD_CONSUMED',
        targetUserId: 'user-1',
      }),
    );
  });

  it('reset verification proof가 먼저 소비되면 reset restart required를 반환한다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      emailNormalized: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
      emailVerifiedAt: databaseNow,
    });
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'RESET_PASSWORD',
      eligibleUserId: 'user-1',
      tokenHash: 'a'.repeat(64),
    });
    prisma.verificationCode.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      resetPassword(deps as never, verificationGrant, 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('삭제/미인증 계정도 reset restart required로 중립 처리하고 세션을 건드리지 않는다', async () => {
    for (const user of [
      {
        id: 'user-deleted',
        email: 'deleted@kangwon.ac.kr',
        emailNormalized: 'deleted@kangwon.ac.kr',
        passwordHash: 'hash',
        deletedAt: new Date('2026-05-12T00:00:00.000Z'),
        emailVerifiedAt: databaseNow,
      },
      {
        id: 'user-unverified',
        email: 'unverified@kangwon.ac.kr',
        emailNormalized: 'unverified@kangwon.ac.kr',
        passwordHash: 'hash',
        deletedAt: null,
        emailVerifiedAt: null,
      },
    ]) {
      vi.clearAllMocks();
      prisma.user.findUnique.mockResolvedValue(user);
      verificationService.resolveVerificationGrant.mockResolvedValue({
        id: 'code-1',
        emailNormalized: user.email,
        purpose: 'RESET_PASSWORD',
        eligibleUserId: user.id,
        tokenHash: 'a'.repeat(64),
      });

      await expect(
        resetPassword(deps as never, verificationGrant, 'NewPass1234'),
      ).resolves.toMatchObject({
        success: false,
        code: 'AUTH_RESET_RESTART_REQUIRED',
      });

      expect(verificationService.resolveVerificationGrant).toHaveBeenCalledWith(
        verificationGrant,
        'RESET_PASSWORD',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
      expect(loginAttemptService.clearFailuresInTransaction).not.toHaveBeenCalled();
    }
  });

  it('grant에 귀속된 user와 email subject가 다르면 password를 변경하지 않는다', async () => {
    verificationService.resolveVerificationGrant.mockResolvedValue({
      id: 'code-1',
      emailNormalized: 'owner@kangwon.ac.kr',
      purpose: 'RESET_PASSWORD',
      eligibleUserId: 'user-1',
      tokenHash: 'a'.repeat(64),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'other@kangwon.ac.kr',
      emailNormalized: 'other@kangwon.ac.kr',
      passwordHash: 'hash',
      deletedAt: null,
      emailVerifiedAt: databaseNow,
    });

    await expect(
      resetPassword(deps as never, verificationGrant, 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_RESET_RESTART_REQUIRED',
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
