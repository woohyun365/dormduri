import { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import type { AuthSecurityEventInput } from './auth-security-event.types.js';

describe('AuthLoginAttemptService', () => {
  const prisma = {
    loginAttempt: {
      deleteMany: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
  };
  const securityEvents = {
    recordSafely: jest.fn<Promise<void>, [AuthSecurityEventInput]>().mockResolvedValue(undefined),
  };

  const service = new AuthLoginAttemptService(prisma as never, securityEvents as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('활성 잠금이 없으면 null을 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([]);

    await expect(service.getActiveLock('test@kangwon.ac.kr')).resolves.toBeNull();
  });

  it('활성 잠금이 있으면 잠금 응답을 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ remainingSeconds: 120 }]);

    await expect(service.getActiveLock('test@kangwon.ac.kr')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
      remainingSeconds: 120,
    });
  });

  it('실패 횟수가 잠금 기준 미만이면 invalid credentials를 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ failureCount: 1, lockedUntil: null }]);

    await expect(service.recordLoginFailure('test@kangwon.ac.kr')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOGIN_FAILURE',
        emailNormalized: 'test@kangwon.ac.kr',
        metadata: {
          metricName: 'auth.login.failure',
          failureCount: 1,
        },
      }),
    );
  });

  it('실패 횟수가 잠금 기준 이상이면 잠금 응답을 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ failureCount: 5, lockedUntil: new Date() }]);

    await expect(service.recordLoginFailure('test@kangwon.ac.kr')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
    });
    expect(securityEvents.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOGIN_LOCKOUT',
        emailNormalized: 'test@kangwon.ac.kr',
        metadata: {
          metricName: 'auth.login.lockout',
          reason: 'threshold_reached',
          failureCount: 5,
          ttlSeconds: 300,
        },
      }),
    );
  });
});
