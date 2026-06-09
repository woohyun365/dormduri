import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { createRetentionAccessLog } from '../retention-access-log-owner.js';
import { disposeDueRetainedVaultObjects } from '../vault/retained-vault.service.js';
import type { RetainedIdentityDisposalResult } from './retained-identity.types.js';

export async function disposeExpiredRetainedIdentities(
  prisma: Pick<
    PrismaService,
    'retainedIdentity' | 'retainedVaultObject' | 'retentionAccessLog' | 'retentionReviewJob'
  >,
  now: Date,
): Promise<RetainedIdentityDisposalResult> {
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
  });

  let processedCount = 0;
  for (const identity of dueIdentities) {
    await prisma.retainedIdentity.update({
      where: { id: identity.id },
      data: {
        originalUserId: null,
        emailHash: null,
        encryptedIdentifierPayload: Prisma.JsonNull,
        identifierKeyVersion: null,
        retentionDisposedAt: now,
        retentionDisposalReason: 'RETENTION_HOLD_EXPIRED',
      },
    });
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

  const vaultDisposal = await disposeDueRetainedVaultObjects(prisma, now);

  return { processedCount: processedCount + vaultDisposal.processedCount };
}
