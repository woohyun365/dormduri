import { hash as argonHash } from '@node-rs/argon2';
import { login } from './login.command.js';
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
      findUnique: jest.fn(),
    },
  };
  const loginAttemptService = {
    getActiveLock: jest.fn(),
    clearFailures: jest.fn(),
    recordLoginFailure: jest.fn(),
  };
  const sessionService = {
    issueAuthResult: jest.fn(),
  };
  const securityEvents = {
    recordSafely: jest.fn<Promise<void>, [AuthSecurityEventInput]>().mockResolvedValue(undefined),
  };

  const deps = {
    prisma,
    loginAttemptService,
    sessionService,
    securityEvents,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    loginAttemptService.getActiveLock.mockResolvedValue(null);
    loginAttemptService.recordLoginFailure.mockResolvedValue({
      success: false,
      error: '이메일 또는 비밀번호가 올바르지 않습니다.',
      code: 'AUTH_INVALID_CREDENTIALS',
      userActionable: true,
    });
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
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
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
    expect(loginAttemptService.clearFailures).not.toHaveBeenCalled();
    expect(sessionService.issueAuthResult).not.toHaveBeenCalled();
  });

  it('활성 잠금이 있으면 login은 즉시 잠금 응답을 반환한다', async () => {
    loginAttemptService.getActiveLock.mockResolvedValue({
      success: false,
      error: '로그인 시도가 5회 실패하여 계정이 5분간 잠겼습니다.',
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
  });
});
