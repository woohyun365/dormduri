import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hash as argonHash } from '@node-rs/argon2';
import { changePassword } from './change-password.command.js';
import type { AuthSecurityEventInput } from '../security-events/auth-security-event.types.js';

const hashPasswordForTest = (password: string) =>
  argonHash(password, {
    algorithm: 2,
    memoryCost: 8192,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

describe('changePassword command', () => {
  const databaseNow = new Date('2026-04-23T00:00:00.000Z');
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const sessionService = {
    issueAuthResult: vi.fn(),
  };
  const securityEvents = {
    recordSafely: vi
      .fn<(arg0: AuthSecurityEventInput) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  const deps = { prisma, sessionService, securityEvents };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.user.update.mockResolvedValue(undefined);
    prisma.authSession.findFirst.mockResolvedValue({ id: 'session-1', rememberMe: true });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        user: { update: prisma.user.update },
        authSession: {
          findFirst: prisma.authSession.findFirst,
          updateMany: prisma.authSession.updateMany,
        },
      }),
    );
  });

  it('현재 비밀번호 확인 후 모든 세션을 revoke하고 새 현재 세션 access token을 반환한다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'rotated-access-token',
      renewalToken: 'rotated-renewal-token',
      sessionId: 'session-new',
    });

    await expect(
      changePassword(
        deps as never,
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
        { requestIp: '127.0.0.1', userAgent: 'jest' },
      ),
    ).resolves.toEqual({
      success: true,
      accessToken: 'rotated-access-token',
      renewalToken: 'rotated-renewal-token',
      rememberMe: true,
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: { gt: databaseNow },
      },
      select: { rememberMe: true },
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: databaseNow },
    });
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      true,
    );
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CHANGE_PASSWORD_SUCCESS',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        sessionId: 'session-new',
        requestIp: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SESSION_REVOKE_ALL',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        sessionId: 'session-1',
        metadata: { reason: 'change_password', revokedCount: 2 },
      }),
    );
  });

  it('auth context에 session id가 없으면 재인증을 요구하고 user/session을 조회하지 않는다', async () => {
    await expect(
      changePassword(
        deps as never,
        { id: 'user-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('현재 authenticated session이 이미 없으면 재인증을 요구하고 password update를 rollback한다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
    });
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(
      changePassword(
        deps as never,
        { id: 'user-1', sessionId: 'session-revoked', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('현재 비밀번호가 틀리면 password update/session revoke/token 재발급을 하지 않는다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
    });

    await expect(
      changePassword(
        deps as never,
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'WrongPass1234',
        'NewPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
      fieldErrors: { currentPassword: '현재 비밀번호가 올바르지 않습니다.' },
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('새 비밀번호가 현재 비밀번호와 같으면 거부한다', async () => {
    const currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
    });

    await expect(
      changePassword(
        deps as never,
        { id: 'user-1', sessionId: 'session-1', gender: 'M', campus: 'CHUNCHEON' },
        'OldPass1234',
        'OldPass1234',
      ),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_UNCHANGED',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });
});
