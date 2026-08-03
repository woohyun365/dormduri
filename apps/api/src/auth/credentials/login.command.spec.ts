import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hash as argonHash } from '@node-rs/argon2';
import { login } from './login.command.js';
import { verifyPasswordHash } from './password-hash.js';
import type { AuthSecurityEventInput } from '../security-events/auth-security-event.types.js';

const hashPasswordForTest = (password: string) =>
  argonHash(password, {
    algorithm: 2,
    memoryCost: 8192,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

describe('login command', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const loginAttemptService = {
    getActiveLock: vi.fn(),
    clearFailures: vi.fn(),
    recordLoginFailure: vi.fn(),
  };
  const sessionService = {
    issueAuthResult: vi.fn(),
  };
  const loginMetrics = {
    recordAttempt: vi.fn(),
  };
  const passwordHashPolicy = {
    verifyLoginPassword: vi.fn(),
    verifyUnavailableLogin: vi.fn(),
  };
  const securityEvents = {
    recordSafely: vi
      .fn<(arg0: AuthSecurityEventInput) => Promise<void>>()
      .mockResolvedValue(undefined),
  };

  const deps = {
    prisma,
    loginAttemptService,
    loginMetrics,
    passwordHashPolicy,
    sessionService,
    securityEvents,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });
    passwordHashPolicy.verifyUnavailableLogin.mockResolvedValue(undefined);
    passwordHashPolicy.verifyLoginPassword.mockImplementation(
      (passwordHash: string, password: string) => verifyPasswordHash(passwordHash, password),
    );
  });

  it('존재하지 않는 계정 login은 로그인 실패 기록 서비스로 위임한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(login(deps as never, 'missing@kangwon.ac.kr', 'pw', false)).resolves.toEqual({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });

    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith('missing@kangwon.ac.kr');
    expect(passwordHashPolicy.verifyUnavailableLogin).toHaveBeenCalledWith('pw');
    expect(loginMetrics.recordAttempt).toHaveBeenCalledWith('invalid');
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('존재하지 않는 계정도 canonical dummy password hash를 검증한다', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await login(deps as never, 'missing@kangwon.ac.kr', 'WrongPass1234', false);

    expect(passwordHashPolicy.verifyUnavailableLogin).toHaveBeenCalledWith('WrongPass1234');
  });

  it('삭제 처리된 계정 login은 실패 기록으로 위임하고 세션을 발급하지 않는다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-deleted',
      email: 'deleted@kangwon.ac.kr',
      passwordHash: 'deleted-password-hash',
      deletedAt: new Date('2026-05-12T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '탈퇴한 사용자',
      },
    });

    await expect(login(deps as never, 'deleted@kangwon.ac.kr', 'Pass1234', false)).resolves.toEqual(
      {
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.',
        code: 'AUTH_INVALID_CREDENTIALS',
        userActionable: true,
      },
    );

    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith('deleted@kangwon.ac.kr');
    expect(passwordHashPolicy.verifyUnavailableLogin).toHaveBeenCalledWith('Pass1234');
    expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('활성 잠금이 있으면 login은 즉시 잠금 응답을 반환한다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValue({
      success: false,
      error: '반복된 로그인 실패로 계정이 잠겼어요.',
      code: 'AUTH_LOGIN_LOCKED',
      userActionable: false,
      locked: true,
      remainingSeconds: 120,
    });

    await expect(
      login(deps as never, 'test@kangwon.ac.kr', 'pass1234', false),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
      remainingSeconds: 120,
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(passwordHashPolicy.verifyUnavailableLogin).not.toHaveBeenCalled();
    expect(loginMetrics.recordAttempt).toHaveBeenCalledWith('locked');
  });

  it('display identity가 없는 계정 login은 인증 성공으로 보지 않고 실패 횟수를 기록한다', async () => {
    const passwordHash = await hashPasswordForTest('Pass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-missing-identity',
      email: 'missing-identity@kangwon.ac.kr',
      passwordHash,
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
    });

    await expect(
      login(deps as never, 'missing-identity@kangwon.ac.kr', 'Pass1234', false),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
    expect(passwordHashPolicy.verifyUnavailableLogin).toHaveBeenCalledWith('Pass1234');
    expect(loginAttemptService.recordLoginFailure).toHaveBeenCalledWith(
      'missing-identity@kangwon.ac.kr',
    );
    expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
  });

  it('정상 login은 failure를 clear하고 세션을 발급하며 success event를 남긴다', async () => {
    const passwordHash = await hashPasswordForTest('Pass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash,
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: {
        nickname: '테스터',
      },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      renewalToken: 'renewal-token',
      sessionId: 'session-1',
    });

    await expect(
      login(deps as never, 'test@kangwon.ac.kr', 'Pass1234', true, {
        requestIp: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toMatchObject({
      success: true,
      accessToken: 'token',
      renewalToken: 'renewal-token',
      user: {
        id: 'user-1',
        email: 'test@kangwon.ac.kr',
        nickname: '테스터',
      },
    });

    expect(loginAttemptService.clearFailures).toHaveBeenCalledWith('test@kangwon.ac.kr');
    expect(sessionService.issueAuthResult).toHaveBeenCalledWith(
      'user-1',
      'test@kangwon.ac.kr',
      true,
    );
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOGIN_SUCCESS',
        actorUserId: 'user-1',
        targetUserId: 'user-1',
        sessionId: 'session-1',
        emailNormalized: 'test@kangwon.ac.kr',
        requestIp: '127.0.0.1',
        userAgent: 'jest',
        metadata: { rememberMe: true },
      }),
    );
    expect(loginMetrics.recordAttempt).toHaveBeenCalledWith('success');
  });

  it('기존 계정 login은 신규 비밀번호 blocklist를 재강제하지 않는다', async () => {
    const passwordHash = await hashPasswordForTest('Password1!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash,
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
    });
    sessionService.issueAuthResult.mockResolvedValue({
      accessToken: 'token',
      renewalToken: 'renewal-token',
      sessionId: 'session-1',
    });

    await expect(
      login(deps as never, 'test@kangwon.ac.kr', 'Password1!', false),
    ).resolves.toMatchObject({ success: true });

    expect(passwordHashPolicy.verifyLoginPassword).toHaveBeenCalledWith(passwordHash, 'Password1!');
  });

  it('ASCII 외 문자나 공백이 있는 login 입력은 account lookup과 Argon 전에 거절한다', async () => {
    await expect(
      login(deps as never, 'test@kangwon.ac.kr', 'Password 한글2026', false),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(passwordHashPolicy.verifyLoginPassword).not.toHaveBeenCalled();
    expect(passwordHashPolicy.verifyUnavailableLogin).not.toHaveBeenCalled();
  });

  it('기존 계정의 잘못된 비밀번호는 real hash를 검증하고 invalid metric을 남긴다', async () => {
    const passwordHash = await hashPasswordForTest('Pass1234');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@kangwon.ac.kr',
      passwordHash,
      deletedAt: null,
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: { nickname: '테스터' },
    });

    await expect(
      login(deps as never, 'test@kangwon.ac.kr', 'WrongPass1234', false),
    ).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });

    expect(passwordHashPolicy.verifyLoginPassword).toHaveBeenCalledWith(
      passwordHash,
      'WrongPass1234',
    );
    expect(passwordHashPolicy.verifyUnavailableLogin).not.toHaveBeenCalled();
    expect(loginMetrics.recordAttempt).toHaveBeenCalledWith('invalid');
  });
});
