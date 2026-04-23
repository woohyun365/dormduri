import { AuthLoginAttemptService } from './auth-login-attempt.service.js';

describe('AuthLoginAttemptService', () => {
  const prisma = {
    loginAttempt: {
      deleteMany: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const service = new AuthLoginAttemptService(prisma as never);

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
    prisma.$queryRaw.mockResolvedValue([{ failureCount: 1, lockedUntil: null }]);

    await expect(service.recordLoginFailure('test@kangwon.ac.kr')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('실패 횟수가 잠금 기준 이상이면 잠금 응답을 반환한다', async () => {
    prisma.$queryRaw.mockResolvedValue([{ failureCount: 5, lockedUntil: new Date() }]);

    await expect(service.recordLoginFailure('test@kangwon.ac.kr')).resolves.toMatchObject({
      success: false,
      code: 'AUTH_LOGIN_LOCKED',
      locked: true,
    });
  });
});
