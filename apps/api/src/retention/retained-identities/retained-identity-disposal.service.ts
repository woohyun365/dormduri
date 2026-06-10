import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { createRetentionAccessLog } from '../access-logs/create-retention-access-log.command.js';
import { disposeDueRetainedVaultObjects } from '../vault/retained-vault.service.js';
import type { RetainedIdentityDisposalResult } from './retained-identity.types.js';

const DEFAULT_RETAINED_IDENTITY_DISPOSAL_BATCH_SIZE = 100;
const MAX_RETAINED_IDENTITY_DISPOSAL_BATCH_SIZE = 500;

export function clampRetainedIdentityDisposalBatchSize(batchSize?: number) {
  const requested = batchSize ?? DEFAULT_RETAINED_IDENTITY_DISPOSAL_BATCH_SIZE;
  return Math.max(1, Math.min(requested, MAX_RETAINED_IDENTITY_DISPOSAL_BATCH_SIZE));
}

export async function disposeExpiredRetainedIdentities(
  prisma: Pick<
    PrismaService,
    'retainedIdentity' | 'retainedVaultObject' | 'retentionAccessLog' | 'retentionReviewJob'
  >,
  now: Date,
  options: { batchSize?: number } = {},
): Promise<RetainedIdentityDisposalResult> {
  const safeBatchSize = clampRetainedIdentityDisposalBatchSize(options.batchSize);
  const dueIdentities = await prisma.retainedIdentity.findMany({
    where: {
      retentionDisposedAt: null,
      holds: {
        some: {},
        every: {
          OR: [{ releasedAt: { not: null } }, { holdUntil: { not: null, lte: now } }],
        },
      },
    },
    select: { id: true },
    orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
    take: safeBatchSize,
  });

  let processedCount = 0;
  for (const identity of dueIdentities) {
    const updateResult = await prisma.retainedIdentity.updateMany({
      where: { id: identity.id, retentionDisposedAt: null },
      data: {
        originalUserId: null,
        emailHash: null,
        encryptedIdentifierPayload: Prisma.JsonNull,
        identifierKeyVersion: null,
        retentionDisposedAt: now,
        retentionDisposalReason: 'RETENTION_HOLD_EXPIRED',
      },
    });
    if (updateResult.count === 0) {
      continue;
    }
    await createRetentionAccessLog(prisma, {
      retainedIdentityId: identity.id,
      targetType: 'IDENTITY_ANCHOR',
      accessedBy: 'SYSTEM',
      accessReason: 'RETENTION_EXPIRY_REVIEW',
      approvalReference: 'SYSTEM_RETENTION_EXPIRY',
      purpose: '보존 기간 만료에 따른 식별 복원 anchor 폐기',
      result: 'DISPOSED',
      disclosedFields: [],
      createdAt: now,
    });
    processedCount += 1;
  }

  const vaultDisposal = await disposeDueRetainedVaultObjects(prisma, now, {
    batchSize: safeBatchSize,
  });

  return { processedCount: processedCount + vaultDisposal.processedCount };
}
