import { disposeExpiredRetainedIdentities } from './retained-identity-disposal.service.js';

function makePrisma(input: { retainedIdentityUpdateCount: number; vaultUpdateCount?: number }) {
  return {
    retainedIdentity: {
      findMany: jest.fn().mockResolvedValue([{ id: 'retained-1' }]),
      updateMany: jest.fn().mockResolvedValue({ count: input.retainedIdentityUpdateCount }),
    },
    retainedVaultObject: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'vault-1',
          target: 'NICKNAME_AUDIT_EVENT',
          subjectRetainedIdentityId: 'retained-1',
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: input.vaultUpdateCount ?? 1 }),
    },
    retentionAccessLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };
}

describe('disposeExpiredRetainedIdentities', () => {
  const now = new Date('2029-01-01T00:00:00.000Z');

  it('bounded batch와 conditional update로 retained identity/vault disposal을 처리한다', async () => {
    const prisma = makePrisma({ retainedIdentityUpdateCount: 1, vaultUpdateCount: 1 });

    await expect(disposeExpiredRetainedIdentities(prisma as never, now)).resolves.toEqual({
      processedCount: 2,
    });

    expect(prisma.retainedIdentity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(prisma.retainedIdentity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'retained-1', retentionDisposedAt: null },
      }),
    );
    expect(prisma.retainedVaultObject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
    expect(prisma.retainedVaultObject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vault-1', state: 'RETAINED' },
      }),
    );
    expect(prisma.retentionAccessLog.create).toHaveBeenCalledTimes(2);
  });

  it('이미 다른 worker가 dispose한 identity는 중복 access log를 남기지 않는다', async () => {
    const prisma = makePrisma({ retainedIdentityUpdateCount: 0, vaultUpdateCount: 0 });

    await expect(disposeExpiredRetainedIdentities(prisma as never, now)).resolves.toEqual({
      processedCount: 0,
    });
    expect(prisma.retentionAccessLog.create).not.toHaveBeenCalled();
  });
});
