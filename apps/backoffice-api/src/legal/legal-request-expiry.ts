import type { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { LEGAL_REQUEST_KINDS } from './legal-records.js';

/**
 * Closes pending legal requests past their expiry and returns their drafts to editing.
 * Like the role requests, expiry is written when someone next saves, requests or
 * decides; it runs in its own transaction so it survives the caller's rollback. A draft also returns
 * to editing when no pending publish request names it any more: the records cleanup deletes a
 * long-expired pending request once its audit rows are gone.
 */
export async function expireLegalRequests(
  prisma: BackofficeRuntimePrisma,
  target: { readonly requestId?: string; readonly draftId?: string },
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const expired = await tx.adminApprovalRequest.findMany({
      where: {
        kind: LEGAL_REQUEST_KINDS,
        status: 'PENDING',
        expiresAt: { lte: now },
        ...(target.requestId ? { id: target.requestId } : {}),
        ...(target.draftId ? { targetLegalDraftId: target.draftId } : {}),
      },
      select: { id: true, targetLegalDraftId: true },
    });
    for (const request of expired) {
      const closed = await tx.adminApprovalRequest.updateMany({
        where: { id: request.id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', closedAt: now },
      });
      if (closed.count === 1 && request.targetLegalDraftId) {
        await tx.legalDocumentDraft.updateMany({
          where: { id: request.targetLegalDraftId, status: 'PENDING_APPROVAL' },
          data: { status: 'EDITING' },
        });
      }
    }
    if (target.draftId) {
      // A publish request and the draft's freeze commit together, so a waiting draft without a
      // pending request has lost its request row.
      await tx.legalDocumentDraft.updateMany({
        where: {
          id: target.draftId,
          status: 'PENDING_APPROVAL',
          publishRequests: { none: { status: 'PENDING' } },
        },
        data: { status: 'EDITING' },
      });
    }
  });
}
