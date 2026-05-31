import { Prisma } from '../generated/prisma/client.js';
import type {
  RetainedVaultObjectTarget,
  RetentionAccessReason,
  RetentionAccessResult,
  RetentionAccessTargetType,
} from '../generated/prisma/enums.js';

const ACCESS_LOG_RETENTION_DAYS = 365 * 3;
const ACCESS_LOG_DISPOSAL_JOB_SOURCE_ID = 'retention-access-log-hard-disposal';

type RetentionAccessLogClient = Pick<Prisma.TransactionClient, 'retentionAccessLog'> &
  Partial<Pick<Prisma.TransactionClient, 'retentionReviewJob'>>;

export interface CreateRetentionAccessLogInput {
  targetType: RetentionAccessTargetType;
  retainedIdentityId?: string | null;
  retainedVaultObjectId?: string | null;
  vaultTarget?: RetainedVaultObjectTarget | null;
  accessedBy: string;
  accessReason: RetentionAccessReason;
  approvalReference: string;
  purpose: string;
  result: RetentionAccessResult;
  disclosedFields: string[];
  createdAt?: Date;
  logRetentionHoldUntil?: Date | null;
}

export interface RetentionAccessLogDisposalResult {
  processedCount: number;
  nextDueAt: Date | null;
}

export async function createRetentionAccessLog(
  prisma: RetentionAccessLogClient,
  input: CreateRetentionAccessLogInput,
) {
  const createdAt = input.createdAt ?? new Date();
  const logRetentionHoldUntil =
    input.logRetentionHoldUntil === undefined
      ? addDays(createdAt, ACCESS_LOG_RETENTION_DAYS)
      : input.logRetentionHoldUntil;

  await prisma.retentionAccessLog.create({
    data: {
      targetType: input.targetType,
      retainedIdentityId: input.retainedIdentityId ?? undefined,
      retainedVaultObjectId: input.retainedVaultObjectId ?? undefined,
      vaultTarget: input.vaultTarget ?? undefined,
      accessedBy: input.accessedBy,
      accessReason: input.accessReason,
      approvalReference: input.approvalReference,
      purpose: input.purpose,
      result: input.result,
      disclosedFields: input.disclosedFields as Prisma.InputJsonValue,
      logRetentionHoldUntil: logRetentionHoldUntil ?? undefined,
      createdAt,
    },
  });

  const retentionReviewJob = prisma.retentionReviewJob;
  if (logRetentionHoldUntil && retentionReviewJob) {
    await scheduleAccessLogDisposalReviewJob({ retentionReviewJob }, logRetentionHoldUntil);
  }
}

export async function disposeDueRetentionAccessLogs(
  prisma: Pick<Prisma.TransactionClient, 'retentionAccessLog'>,
  now: Date,
): Promise<RetentionAccessLogDisposalResult> {
  const result = await prisma.retentionAccessLog.updateMany({
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

  const nextDueLog = await prisma.retentionAccessLog.findFirst({
    where: {
      logRetentionDisposedAt: null,
      logRetentionHoldUntil: { not: null, gt: now },
    },
    select: { logRetentionHoldUntil: true },
    orderBy: { logRetentionHoldUntil: 'asc' },
  });

  return { processedCount: result.count, nextDueAt: nextDueLog?.logRetentionHoldUntil ?? null };
}

async function scheduleAccessLogDisposalReviewJob(
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
