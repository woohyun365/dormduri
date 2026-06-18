import { scheduleAccessLogDisposalReviewJob } from './retention-access-log-disposal-review.command.js';
import type {
  CreateRetentionAccessLogInput,
  RetentionAccessLogClient,
} from './retention-access-log.types.js';

const ACCESS_LOG_RETENTION_DAYS = 365 * 3;

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
      disclosedFields: input.disclosedFields,
      logRetentionHoldUntil: logRetentionHoldUntil ?? undefined,
      createdAt,
    },
  });

  const retentionReviewJob = prisma.retentionReviewJob;
  if (logRetentionHoldUntil && retentionReviewJob) {
    await scheduleAccessLogDisposalReviewJob({ retentionReviewJob }, logRetentionHoldUntil);
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
