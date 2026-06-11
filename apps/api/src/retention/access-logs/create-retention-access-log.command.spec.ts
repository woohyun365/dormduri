import { createRetentionAccessLog } from './create-retention-access-log.command.js';

type AccessLogCreateArgs = { data: Record<string, unknown> };
type ReviewJobFindUniqueArgs = { where: unknown; select: unknown };
type ReviewJobCreateArgs = { data: Record<string, unknown> };
type ReviewJobUpdateArgs = { where: unknown; data: Record<string, unknown> };

function createPrismaDouble() {
  return {
    retentionAccessLog: {
      create: jest.fn<Promise<undefined>, [AccessLogCreateArgs]>().mockResolvedValue(undefined),
    },
    retentionReviewJob: {
      findUnique: jest.fn<Promise<null>, [ReviewJobFindUniqueArgs]>().mockResolvedValue(null),
      create: jest.fn<Promise<undefined>, [ReviewJobCreateArgs]>().mockResolvedValue(undefined),
      update: jest.fn<Promise<undefined>, [ReviewJobUpdateArgs]>().mockResolvedValue(undefined),
    },
  };
}

describe('createRetentionAccessLog', () => {
  it('approval/access metadata를 기록하고 기본 3년 log retention disposal review job을 예약한다', async () => {
    const prisma = createPrismaDouble();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');

    await createRetentionAccessLog(prisma as never, {
      targetType: 'IDENTITY_ANCHOR',
      retainedIdentityId: 'retained-identity-1',
      accessedBy: 'operator-1',
      accessReason: 'REPORT_REVIEW',
      approvalReference: 'approval-1',
      purpose: 'dispute resolution',
      result: 'DISCLOSED',
      disclosedFields: ['email'],
      createdAt,
    });

    const expectedHoldUntil = new Date('2028-12-31T00:00:00.000Z');
    expect(prisma.retentionAccessLog.create).toHaveBeenCalledTimes(1);
    const [accessLogCreateArgs] = prisma.retentionAccessLog.create.mock.calls[0]!;
    expect(accessLogCreateArgs.data).toMatchObject({
      targetType: 'IDENTITY_ANCHOR',
      retainedIdentityId: 'retained-identity-1',
      accessedBy: 'operator-1',
      approvalReference: 'approval-1',
      purpose: 'dispute resolution',
      disclosedFields: ['email'],
      logRetentionHoldUntil: expectedHoldUntil,
      createdAt,
    });
    expect(prisma.retentionReviewJob.create).toHaveBeenCalledTimes(1);
    const [reviewJobCreateArgs] = prisma.retentionReviewJob.create.mock.calls[0]!;
    expect(reviewJobCreateArgs.data).toMatchObject({
      target: 'ACCESS_LOG_DISPOSAL',
      sourceId: 'retention-access-log-hard-disposal',
      dueAt: expectedHoldUntil,
    });
  });

  it('logRetentionHoldUntil이 null이면 disposal review job을 예약하지 않는다', async () => {
    const prisma = createPrismaDouble();

    await createRetentionAccessLog(prisma as never, {
      targetType: 'IDENTITY_ANCHOR',
      retainedIdentityId: 'retained-identity-1',
      accessedBy: 'operator-1',
      accessReason: 'SECURITY_AUDIT',
      approvalReference: 'approval-1',
      purpose: 'legal hold review',
      result: 'DENIED',
      disclosedFields: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      logRetentionHoldUntil: null,
    });

    expect(prisma.retentionReviewJob.findUnique).not.toHaveBeenCalled();
    expect(prisma.retentionReviewJob.create).not.toHaveBeenCalled();
  });
});
