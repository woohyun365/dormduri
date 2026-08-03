import { hash as argonHash } from '@node-rs/argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from './change-password.command.js';

const hashPasswordForTest = (password: string) =>
  argonHash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

describe('changePassword command', () => {
  const databaseNow = new Date('2026-04-23T00:00:00.000Z');
  const preparedSession = {
    result: {
      accessToken: 'rotated-access-token',
      renewalToken: 'rotated-renewal-token',
      sessionId: 'session-new',
    },
    persistence: {
      sessionId: 'session-new',
      userId: 'user-1',
      rememberMe: true,
    },
  };
  let currentPasswordHash: string;
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    authSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const sessionService = {
    prepareSessionIssue: vi.fn(),
    appendPreparedSession: vi.fn(),
  };
  const securityEvents = {
    recordInTransaction: vi.fn(),
  };
  const mailOutboxWriter = {
    appendPasswordChanged: vi.fn(),
  };
  const admission = { consume: vi.fn() };
  const passwordPolicy = { evaluateNewPassword: vi.fn() };
  const flowMetrics = { recordSensitiveMutation: vi.fn() };
  const deps = {
    prisma,
    sessionService,
    securityEvents,
    mailOutboxWriter,
    admission,
    passwordPolicy,
    flowMetrics,
  };
  const authUser = {
    id: 'user-1',
    sessionId: 'session-1',
    gender: 'M',
    campus: 'CHUNCHEON',
  } as const;

  beforeEach(async () => {
    vi.clearAllMocks();
    currentPasswordHash = await hashPasswordForTest('OldPass1234');
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash: currentPasswordHash,
      deletedAt: null,
      displayIdentity: { nickname: '테스터' },
    });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.findFirst.mockResolvedValue({ id: 'session-1', rememberMe: true });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        user: { updateMany: prisma.user.updateMany },
        authSession: {
          findFirst: prisma.authSession.findFirst,
          updateMany: prisma.authSession.updateMany,
        },
      }),
    );
    sessionService.prepareSessionIssue.mockResolvedValue(preparedSession);
    sessionService.appendPreparedSession.mockResolvedValue(undefined);
    securityEvents.recordInTransaction.mockResolvedValue(undefined);
    mailOutboxWriter.appendPasswordChanged.mockResolvedValue(undefined);
    admission.consume.mockResolvedValue(null);
    passwordPolicy.evaluateNewPassword.mockReturnValue({ ok: true });
  });

  it('현재 비밀번호 확인 후 기존 세션을 revoke하고 같은 transaction의 대체 세션을 반환한다', async () => {
    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234', {
        requestIp: '127.0.0.1',
        userAgent: 'vitest',
      }),
    ).resolves.toEqual({
      success: true,
      accessToken: 'rotated-access-token',
      renewalToken: 'rotated-renewal-token',
      rememberMe: true,
    });

    const passwordUpdate = prisma.user.updateMany.mock.calls[0]?.[0] as unknown as
      | {
          where: { id: string; passwordHash: string; deletedAt: null };
          data: { passwordHash: string };
        }
      | undefined;
    expect(passwordUpdate?.where).toEqual({
      id: 'user-1',
      passwordHash: currentPasswordHash,
      deletedAt: null,
    });
    expect(typeof passwordUpdate?.data.passwordHash).toBe('string');
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: databaseNow },
    });
    expect(sessionService.prepareSessionIssue).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      true,
    );
    expect(sessionService.appendPreparedSession).toHaveBeenCalledWith(
      expect.anything(),
      preparedSession,
    );
    expect(mailOutboxWriter.appendPasswordChanged).toHaveBeenCalledWith(expect.anything(), {
      targetUserId: 'user-1',
      email: 'test@kangwon.ac.kr',
      now: databaseNow,
    });
    expect(securityEvents.recordInTransaction).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        type: 'SESSION_REVOKE_ALL',
        sessionId: 'session-1',
        requestIp: '127.0.0.1',
        userAgent: 'vitest',
        metadata: { reason: 'change_password', revokedCount: 2 },
      }),
    );
    expect(securityEvents.recordInTransaction).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        type: 'CHANGE_PASSWORD_SUCCEEDED',
        sessionId: 'session-new',
      }),
    );
  });

  it('transaction에서 current session의 active 상태와 rememberMe를 다시 확인한다', async () => {
    await changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234');

    expect(prisma.authSession.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'session-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: { gt: databaseNow },
      },
      select: { rememberMe: true },
    });
    expect(prisma.authSession.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'session-1',
        userId: 'user-1',
        rememberMe: true,
        revokedAt: null,
        expiresAt: { gt: databaseNow },
      },
      select: { id: true },
    });
  });

  it('대체 session과 필수 audit은 credential transaction이 열린 동안 append한다', async () => {
    let transactionOpen = false;
    prisma.runSerializableTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionOpen = true;
        try {
          return await callback({
            user: { updateMany: prisma.user.updateMany },
            authSession: {
              findFirst: prisma.authSession.findFirst,
              updateMany: prisma.authSession.updateMany,
            },
          });
        } finally {
          transactionOpen = false;
        }
      },
    );
    sessionService.appendPreparedSession.mockImplementation(() => {
      expect(transactionOpen).toBe(true);
      return Promise.resolve();
    });
    securityEvents.recordInTransaction.mockImplementation(() => {
      expect(transactionOpen).toBe(true);
      return Promise.resolve();
    });

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).resolves.toMatchObject({ success: true });
  });

  it('auth context에 session id가 없으면 user/session을 조회하지 않고 재인증을 요구한다', async () => {
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
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
    expect(admission.consume).not.toHaveBeenCalled();
  });

  it('session admission budget이 차단되면 password hash와 login lock 변경 없이 거부한다', async () => {
    admission.consume.mockResolvedValue(587);

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_CHANGE_PASSWORD_THROTTLED',
      retryAfterSeconds: 587,
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
  });

  it('transaction 재검증에서 current session이 사라지면 다른 변경 없이 재인증을 요구한다', async () => {
    prisma.authSession.findFirst
      .mockResolvedValueOnce({ id: 'session-1', rememberMe: true })
      .mockResolvedValueOnce(null);

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
  });

  it('현재 비밀번호가 틀리면 credential/session mutation을 시작하지 않는다', async () => {
    await expect(
      changePassword(deps as never, authUser, 'WrongPass1234', 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_CURRENT_PASSWORD_INVALID',
    });

    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
  });

  it('새 비밀번호 정책 위반은 신규 hash와 credential transaction 전에 거부한다', async () => {
    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'short'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
    });

    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('취약 비밀번호는 same-password verify와 credential transaction 전에 generic하게 거부한다', async () => {
    const password = 'Password1!';
    passwordPolicy.evaluateNewPassword.mockReturnValue({
      ok: false,
      code: 'COMMON_VALUE',
    });

    const result = await changePassword(deps as never, authUser, 'OldPass1234', password);

    expect(result).toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_POLICY_VIOLATION',
      fieldErrors: {
        newPassword: '다른 비밀번호를 입력해 주세요.',
      },
    });
    expect(JSON.stringify(result)).not.toContain(password);
    expect(passwordPolicy.evaluateNewPassword).toHaveBeenCalledWith(password, {
      email: 'test@kangwon.ac.kr',
      nickname: '테스터',
    });
    expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('새 비밀번호가 현재 비밀번호와 같으면 거부한다', async () => {
    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'OldPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_PASSWORD_UNCHANGED',
    });

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(sessionService.prepareSessionIssue).not.toHaveBeenCalled();
  });

  it('observed password hash CAS가 실패하면 revoke/session/outbox/audit 없이 재인증을 요구한다', async () => {
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_REAUTHENTICATION_REQUIRED',
    });

    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(sessionService.appendPreparedSession).not.toHaveBeenCalled();
    expect(mailOutboxWriter.appendPasswordChanged).not.toHaveBeenCalled();
    expect(securityEvents.recordInTransaction).not.toHaveBeenCalled();
  });

  it('replacement session append 실패는 command 실패로 전파한다', async () => {
    sessionService.appendPreparedSession.mockRejectedValue(
      new Error('replacement session unavailable'),
    );

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).rejects.toThrow('replacement session unavailable');

    expect(mailOutboxWriter.appendPasswordChanged).not.toHaveBeenCalled();
    expect(securityEvents.recordInTransaction).not.toHaveBeenCalled();
    expect(flowMetrics.recordSensitiveMutation).toHaveBeenCalledWith(
      'change_password',
      'replacement_session_failed',
    );
  });

  it('필수 audit append 실패는 command 실패로 전파한다', async () => {
    securityEvents.recordInTransaction.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      changePassword(deps as never, authUser, 'OldPass1234', 'NewPass1234'),
    ).rejects.toThrow('audit unavailable');

    expect(sessionService.appendPreparedSession).toHaveBeenCalledTimes(1);
    expect(mailOutboxWriter.appendPasswordChanged).toHaveBeenCalledTimes(1);
    expect(flowMetrics.recordSensitiveMutation).toHaveBeenCalledWith(
      'change_password',
      'audit_append_failed',
    );
  });
});
