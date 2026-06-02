import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

type TransactionCallback = (tx: unknown) => Promise<unknown>;
type TransactionOptions = { isolationLevel?: unknown };

type PrismaServiceHarness = PrismaService & {
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback, TransactionOptions]>;
};

function makeHarness(): PrismaServiceHarness {
  const harness = Object.create(PrismaService.prototype) as PrismaServiceHarness;
  harness.$transaction = jest.fn();
  return harness;
}

function makeSerializationConflict() {
  return new Error('serialization failure', {
    cause: { originalCode: '40001', kind: 'TransactionWriteConflict' },
  });
}

describe('PrismaService serializable transaction retry', () => {
  it('serialization conflict는 Serializable isolation으로 재시도하고 성공 값을 반환한다', async () => {
    const harness = makeHarness();
    const tx = { tx: true };
    const operation = jest.fn().mockResolvedValue('committed');
    let attempt = 0;

    harness.$transaction.mockImplementation(async (callback) => {
      attempt += 1;
      if (attempt === 1) {
        throw makeSerializationConflict();
      }
      return callback(tx);
    });

    await expect(harness.runSerializableTransaction(operation, 2)).resolves.toBe('committed');

    expect(harness.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(tx);
    for (const [, options] of harness.$transaction.mock.calls) {
      expect(options).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
  });

  it('retry 횟수를 소진하면 마지막 serialization conflict를 그대로 노출한다', async () => {
    const harness = makeHarness();
    const conflict = makeSerializationConflict();
    const operation = jest.fn().mockResolvedValue('unreachable');

    harness.$transaction.mockRejectedValue(conflict);

    await expect(harness.runSerializableTransaction(operation, 2)).rejects.toBe(conflict);
    expect(harness.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).not.toHaveBeenCalled();
  });
});
