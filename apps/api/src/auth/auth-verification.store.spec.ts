import { AuthVerificationStore } from './auth-verification.store.js';

describe('AuthVerificationStore', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    verificationCodeRequestLog: {
      create: jest.fn(),
    },
    verificationCode: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
  };

  const store = new AuthVerificationStore(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
  });

  it('IP cooldown row가 있으면 retryAfterSeconds를 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ retryAfterSeconds: 42 }]);

    await expect(
      store.findRetryAfterSeconds('test@kangwon.ac.kr', 'SIGNUP', '127.0.0.1', 600),
    ).resolves.toBe(42);

    expect(prisma.$queryRawTyped).toHaveBeenCalled();
  });

  it('backstop 제한 미도달이면 null을 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ requestCount: 1, oldestRequestAt: new Date() }]);

    await expect(
      store.findBackstopRetryAfterSeconds('test@kangwon.ac.kr', 'SIGNUP', 600, 5),
    ).resolves.toBeNull();
  });

  it('backstop 제한 도달이면 oldestRequestAt 기준 retryAfterSeconds를 계산한다', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-23T00:00:00.000Z').getTime());
    prisma.$queryRawTyped.mockResolvedValue([
      {
        requestCount: 5,
        oldestRequestAt: new Date('2026-04-22T23:55:30.000Z'),
      },
    ]);

    await expect(
      store.findBackstopRetryAfterSeconds('test@kangwon.ac.kr', 'SIGNUP', 600, 5),
    ).resolves.toBe(330);
  });

  it('request log 생성은 Prisma model create로 위임한다', async () => {
    await store.createRequestLog('test@kangwon.ac.kr', 'SIGNUP', '127.0.0.1');

    expect(prisma.verificationCodeRequestLog.create).toHaveBeenCalledWith({
      data: {
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'SIGNUP',
        requestIp: '127.0.0.1',
      },
    });
  });

  it('latest verified signup code 조회 결과를 그대로 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([{ id: 'code-1' }]);

    await expect(store.findLatestVerifiedSignupCode('test@kangwon.ac.kr', 1800)).resolves.toEqual({
      id: 'code-1',
    });
  });

  it('active verification record 조회 결과를 그대로 반환한다', async () => {
    prisma.$queryRawTyped.mockResolvedValue([
      {
        id: 'code-1',
        codeHash: 'hash',
        failedAttempts: 2,
      },
    ]);

    await expect(
      store.findActiveVerificationRecord('test@kangwon.ac.kr', 'RESET_PASSWORD', 5),
    ).resolves.toEqual({
      id: 'code-1',
      codeHash: 'hash',
      failedAttempts: 2,
    });
  });

  it('consume / invalidate / insert / mark / increment / failAndConsume은 Prisma CRUD로 실행한다', async () => {
    prisma.verificationCode.create.mockResolvedValue({ id: 'code-1' });
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });

    await store.consumeVerificationCode('code-1');
    await store.invalidateActiveSignupCodes('test@kangwon.ac.kr');
    await store.insertVerificationCode({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      codeHash: 'hash',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });
    await store.markVerified('code-1');
    await store.incrementFailedAttempts('code-1');
    await store.failAndConsume('code-1');

    expect(prisma.verificationCode.updateMany).toHaveBeenCalledTimes(5);
    expect(prisma.verificationCode.create).toHaveBeenCalledTimes(1);
  });
});
