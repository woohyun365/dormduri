import type { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import { LEGAL_REQUEST_KINDS } from './legal-records.js';

/**
 * Closes pending legal requests past their expiry and returns their drafts to editing (Owner
 * 2026-11-25 L2b Q1). Like the role requests, expiry is written when someone next saves, requests or
 * decides; it runs in its own transaction so it survives the caller's rollback.
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
  });
}
