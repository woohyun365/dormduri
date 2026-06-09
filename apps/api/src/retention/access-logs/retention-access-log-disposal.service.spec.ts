import { Prisma } from '../../generated/prisma/client.js';
import { disposeDueRetentionAccessLogs } from './retention-access-log-disposal.service.js';

describe('disposeDueRetentionAccessLogs', () => {
  it('due access log metadata를 최소화하고 다음 dueAt을 반환한다', async () => {
    const now = new Date('2029-01-01T00:00:00.000Z');
    const nextDueAt = new Date('2029-02-01T00:00:00.000Z');
    const prisma = {
      retentionAccessLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        findFirst: jest.fn().mockResolvedValue({ logRetentionHoldUntil: nextDueAt }),
      },
    };

    await expect(disposeDueRetentionAccessLogs(prisma as never, now)).resolves.toEqual({
      processedCount: 3,
      nextDueAt,
    });
    expect(prisma.retentionAccessLog.updateMany).toHaveBeenCalledWith({
      where: {
        logRetentionDisposedAt: null,
        logRetentionHoldUntil: { not: null, lte: now },
      },
      data: {
        accessedBy: null,
        approvalReference: null,
        purpose: null,
        disclosedFields: Prisma.JsonNull,
        logRetentionDisposedAt: now,
        logRetentionDisposalReason: 'RETENTION_ACCESS_LOG_METADATA_MINIMIZED',
      },
    });
  });
});
