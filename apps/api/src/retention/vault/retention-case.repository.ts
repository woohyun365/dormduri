import { Prisma } from '../../generated/prisma/client.js';
import type { RetentionCaseReason } from '../../generated/prisma/enums.js';

const POLICY_VERSION = 'rrpd-v1';

export interface EnsureRetentionCaseInput {
  reason: RetentionCaseReason;
  triggerUserId?: string | null;
  triggerRetainedIdentityId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  retentionHoldUntil?: Date | null;
  legalHoldReason?:
    | 'LAW_ENFORCEMENT_REQUEST'
    | 'INTERNAL_DISPUTE_REVIEW'
    | 'SAFETY_INCIDENT'
    | 'ADMIN_LEGAL_REVIEW'
    | null;
  approvalReference?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function ensureRetentionCaseTx(
  tx: Prisma.TransactionClient,
  input: EnsureRetentionCaseInput,
) {
  const existing = await tx.retentionCase.findFirst({
    where: {
      reason: input.reason,
      triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? null,
      sourceTable: input.sourceTable ?? null,
      sourceId: input.sourceId ?? null,
    },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  return tx.retentionCase.create({
    data: {
      reason: input.reason,
      triggerUserId: input.triggerUserId ?? undefined,
      triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? undefined,
      sourceTable: input.sourceTable ?? undefined,
      sourceId: input.sourceId ?? undefined,
      retentionHoldUntil: input.retentionHoldUntil ?? undefined,
      legalHoldReason: input.legalHoldReason ?? undefined,
      approvalReference: input.approvalReference ?? undefined,
      policyVersion: POLICY_VERSION,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });
}
