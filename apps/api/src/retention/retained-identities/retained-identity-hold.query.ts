import type { Prisma } from '../../generated/prisma/client.js';
import type { LegalHoldReason, RetentionCaseReason } from '../../generated/prisma/enums.js';

export async function loadRetainedIdentityForCaseTx(
  tx: Prisma.TransactionClient,
  retainedIdentityId: string,
) {
  const retainedIdentity = await tx.retainedIdentity.findUnique({
    where: { id: retainedIdentityId },
    select: {
      holds: {
        where: { releasedAt: null },
        select: {
          holdReason: true,
          holdUntil: true,
          createdAt: true,
          retentionCase: {
            select: {
              legalHoldReason: true,
            },
          },
        },
      },
    },
  });
  if (!retainedIdentity) {
    throw new Error('IDENTITY_ANCHOR_NOT_FOUND');
  }

  const activeHold = selectCanonicalIdentityHold(retainedIdentity.holds);
  if (!activeHold) {
    throw new Error('IDENTITY_ANCHOR_HOLD_NOT_FOUND');
  }

  return {
    retentionCaseReason: activeHold.holdReason,
    retentionHoldUntil: activeHold.holdUntil,
    legalHoldReason: activeHold.retentionCase.legalHoldReason,
  };
}

function selectCanonicalIdentityHold(
  holds: Array<{
    holdReason: RetentionCaseReason;
    holdUntil: Date | null;
    createdAt: Date;
    retentionCase: { legalHoldReason: LegalHoldReason | null };
  }>,
) {
  return [...holds].sort((left, right) => {
    const priorityDelta =
      retentionHoldPriority(left.holdReason) - retentionHoldPriority(right.holdReason);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0];
}

function retentionHoldPriority(reason: string) {
  switch (reason) {
    case 'LEGAL_HOLD':
      return 0;
    case 'ADMIN_MANUAL':
      return 1;
    case 'DISPUTE_RESPONSE':
      return 2;
    case 'REPORT_REVIEW':
      return 3;
    case 'ENFORCEMENT_RECORD':
      return 4;
    case 'ACCOUNT_DELETION':
      return 5;
    default:
      return 99;
  }
}
