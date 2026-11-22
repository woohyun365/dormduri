import type { AuditEventsQuery, AuditReviewRequest } from '@repo/shared/backoffice';
import type { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
import { nextPageAfter, pageCursor } from '../platform/http/keyset-page.js';
import { adminActor, type AdminAuditWriter } from './admin-audit-writer.js';

/**
 * Audit list (`admin:audit:read`) and the monthly review record (`admin:audit:review`, OA-R8).
 * Rows carry account ids, not emails or names: an auditor reads who did what by id, and only the
 * owner role's account list (`admin:account:invite`) maps an id to a person.
 */
export class AdminAuditQueryService {
  constructor(
    private readonly prisma: BackofficeRuntimePrisma,
    private readonly audit: AdminAuditWriter,
  ) {}

  /**
   * Newest first; the next page starts after the last row's time and id (keyset). The `lte` bound
   * repeats the cursor time as a range, so the scan starts at the cursor on the `occurredAt` index
   * instead of filtering every newer row (an OR of two comparisons gives the planner no range).
   */
  async list(query: AuditEventsQuery) {
    const cursor = pageCursor(query);
    const rows = await this.prisma.adminAuditEvent.findMany({
      where: cursor
        ? {
            occurredAt: { lte: cursor.time },
            OR: [
              { occurredAt: { lt: cursor.time } },
              { occurredAt: cursor.time, id: { lt: cursor.id } },
            ],
          }
        : {},
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        occurredAt: true,
        actorType: true,
        actorAccountId: true,
        sessionId: true,
        accessPath: true,
        action: true,
        targetType: true,
        targetId: true,
        approvalRequestId: true,
        result: true,
        selfApproved: true,
        reason: true,
        requestId: true,
        metadata: true,
      },
    });
    return {
      events: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
      nextPage: nextPageAfter(rows, query.limit, (row) => row.occurredAt),
    };
  }

  async recordReview(
    session: AdminRequestSession,
    input: AuditReviewRequest,
    requestId: string,
  ): Promise<{ auditEventId: string }> {
    const auditEventId = await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        ...adminActor({ ...session, requestId }),
        action: 'AUDIT_REVIEW',
        result: 'SUCCEEDED',
        reason: input.note ?? null,
        metadata: { checked: 'admin_audit_and_ssm_session_trail' },
      }),
    );
    return { auditEventId };
  }
}
