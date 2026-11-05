import type { Prisma } from '@repo/database/client';
import type {
  RetainedVaultObjectTarget,
  RetentionAccessReason,
  RetentionAccessResult,
  RetentionAccessTargetType,
} from '@repo/database/enums';

export type RetentionAccessLogClient = Pick<Prisma.TransactionClient, 'retentionAccessLog'> &
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
