import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthVerificationStore } from './verification-code.repository.js';
import { createVerificationGrant, hashVerificationGrant } from './auth-verification-grant.js';

describe('AuthVerificationStore', () => {
  const txQueryRawTyped = vi.fn<(arg0: unknown) => Promise<unknown[]>>();
  const txVerificationCodeUpdateMany = vi.fn<(arg0: unknown) => Promise<{ count: number }>>();
  const txVerificationCodeCreate = vi.fn<(arg0: unknown) => Promise<{ id: string }>>();

  const prisma = {
    getDatabaseNow: vi.fn(),
    verificationCodeRequestLog: {
      create: vi.fn(),
    },
    verificationCode: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $queryRawTyped: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };

  const store = new AuthVerificationStore(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-04-23T00:00:00.000Z'));
    txQueryRawTyped.mockResolvedValue([{ lockAcquired: null }]);
    txVerificationCodeUpdateMany.mockResolvedValue({ count: 1 });
    txVerificationCodeCreate.mockResolvedValue({ id: 'code-1' });
    prisma.runSerializableTransaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRawTyped: txQueryRawTyped,
        verificationCode: {
          updateMany: txVerificationCodeUpdateMany,
          create: txVerificationCodeCreate,
        },
      }),
    );
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
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-23T00:00:00.000Z').getTime());
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

  it('signup code 교체는 serializable transaction + advisory lock으로 수행한다', async () => {
    prisma.verificationCode.create.mockResolvedValue({ id: 'code-1' });
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });

    await store.replaceActiveSignupCode({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      codeHash: 'hash',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txQueryRawTyped).toHaveBeenCalled();
    expect(txVerificationCodeUpdateMany).toHaveBeenCalledWith({
      where: {
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'SIGNUP',
        consumedAt: null,
      },
      data: { consumedAt: new Date('2026-04-23T00:00:00.000Z') },
    });
    const [createCall] = txVerificationCodeCreate.mock.calls;
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected verification code create call');
    }
    expect(createCall[0]).toMatchObject({
      data: {
        id: 'code-1',
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'SIGNUP',
      },
    });
  });

  it('reset code 교체도 serializable transaction + advisory lock으로 active reset code를 교체한다', async () => {
    prisma.verificationCode.create.mockResolvedValue({ id: 'code-1' });
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });

    await store.replaceActiveResetCode({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      codeHash: 'hash',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txVerificationCodeUpdateMany).toHaveBeenCalledWith({
      where: {
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        consumedAt: null,
      },
      data: { consumedAt: new Date('2026-04-23T00:00:00.000Z') },
    });
    const [createCall] = txVerificationCodeCreate.mock.calls;
    expect(createCall?.[0]).toMatchObject({
      data: {
        id: 'code-1',
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
      },
    });
  });

  it('invalidate / insert는 Prisma CRUD로 실행한다', async () => {
    prisma.verificationCode.create.mockResolvedValue({ id: 'code-1' });
    prisma.verificationCode.updateMany.mockResolvedValue({ count: 1 });

    await store.invalidateActiveSignupCodes('test@kangwon.ac.kr');
    await store.insertVerificationCode({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      codeHash: 'hash',
      ttlSeconds: 600,
      requestIp: '127.0.0.1',
    });

    expect(prisma.verificationCode.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.verificationCode.create).toHaveBeenCalledTimes(1);
  });

  it('verify 성공은 advisory lock 아래 15분 grant hash와 reset 대상 user를 저장한다', async () => {
    await expect(
      store.markVerifiedAndIssueGrant({
        id: 'code-1',
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
        grantTokenHash: 'a'.repeat(64),
        grantTtlSeconds: 900,
        eligibleUserId: 'user-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txQueryRawTyped).toHaveBeenCalledTimes(1);
    expect(txVerificationCodeUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'code-1',
        purpose: 'RESET_PASSWORD',
        emailNormalized: 'test@kangwon.ac.kr',
        verifiedAt: null,
        consumedAt: null,
        expiresAt: { gt: new Date('2026-04-23T00:00:00.000Z') },
        failedAttempts: { lt: 5 },
      },
      data: {
        verifiedAt: new Date('2026-04-23T00:00:00.000Z'),
        grantTokenHash: 'a'.repeat(64),
        grantExpiresAt: new Date('2026-04-23T00:15:00.000Z'),
        eligibleUserId: 'user-1',
      },
    });
  });

  it('grant lookup은 token hash를 constant-time 비교하고 purpose와 만료를 검증한다', async () => {
    const grant = createVerificationGrant('code-1');
    prisma.verificationCode.findUnique.mockResolvedValue({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      eligibleUserId: null,
      grantTokenHash: hashVerificationGrant(grant),
      grantExpiresAt: new Date('2026-04-23T00:15:00.000Z'),
      verifiedAt: new Date('2026-04-23T00:00:00.000Z'),
      consumedAt: null,
    });

    await expect(store.resolveVerificationGrant(grant, 'SIGNUP')).resolves.toMatchObject({
      id: 'code-1',
      emailNormalized: 'test@kangwon.ac.kr',
      purpose: 'SIGNUP',
      tokenHash: hashVerificationGrant(grant),
    });
    await expect(store.resolveVerificationGrant(grant, 'RESET_PASSWORD')).resolves.toBeNull();
    await expect(
      store.resolveVerificationGrant(createVerificationGrant('code-1'), 'SIGNUP'),
    ).resolves.toBeNull();
  });

  it('recordVerificationFailure는 advisory lock + TypedSQL 결과로 consume 여부를 반환한다', async () => {
    txQueryRawTyped
      .mockResolvedValueOnce([{ lockAcquired: null }])
      .mockResolvedValueOnce([
        { failedAttempts: 5, consumedAt: new Date('2026-04-23T00:00:00.000Z') },
      ]);

    await expect(
      store.recordVerificationFailure({
        id: 'code-1',
        emailNormalized: 'test@kangwon.ac.kr',
        purpose: 'RESET_PASSWORD',
        maxAttempts: 5,
      }),
    ).resolves.toEqual({ recorded: true, consumed: true });

    expect(prisma.runSerializableTransaction).toHaveBeenCalled();
    expect(txQueryRawTyped).toHaveBeenCalledTimes(2);
  });
});
