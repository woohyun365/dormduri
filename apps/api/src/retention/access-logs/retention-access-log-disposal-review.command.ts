import type { Prisma } from '../../generated/prisma/client.js';

const ACCESS_LOG_DISPOSAL_JOB_SOURCE_ID = 'retention-access-log-hard-disposal';

export async function scheduleAccessLogDisposalReviewJob(
  prisma: Pick<Prisma.TransactionClient, 'retentionReviewJob'>,
  dueAt: Date,
) {
  const existing = await prisma.retentionReviewJob.findUnique({
    where: {
      target_sourceId: {
        target: 'ACCESS_LOG_DISPOSAL',
        sourceId: ACCESS_LOG_DISPOSAL_JOB_SOURCE_ID,
      },
    },
    select: { id: true, dueAt: true, status: true },
  });

  if (!existing) {
    await prisma.retentionReviewJob.create({
      data: {
        target: 'ACCESS_LOG_DISPOSAL',
        sourceId: ACCESS_LOG_DISPOSAL_JOB_SOURCE_ID,
        dueAt,
        payload: {
          schemaVersion: 1,
          source: 'RETENTION_ACCESS_LOG',
        },
      },
    });
    return;
  }

  if (existing.status === 'SUCCEEDED' || existing.dueAt.getTime() > dueAt.getTime()) {
    await prisma.retentionReviewJob.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        dueAt,
        lastErrorCode: null,
        manualReviewRequired: false,
      },
    });
  }
}
