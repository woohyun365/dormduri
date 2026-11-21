import type { AuditEventsQuery, AuditReviewRequest } from '@repo/shared/backoffice';
import type { BackofficeRuntimePrisma } from '../platform/database/backoffice-prisma.js';
import type { AdminRequestSession } from '../platform/http/request-context.js';
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

  async list(query: AuditEventsQuery) {
    const rows = await this.prisma.adminAuditEvent.findMany({
      where: query.before ? { occurredAt: { lt: new Date(query.before) } } : {},
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
    const last = rows.at(-1);
    return {
      events: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
      nextBefore: rows.length === query.limit && last ? last.occurredAt.toISOString() : null,
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
