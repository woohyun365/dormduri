import { randomUUID } from 'node:crypto';
import type {
  AdminAuditAccessPath,
  AdminAuditAction,
  AdminAuditActorType,
  AdminAuditResult,
  AdminAuditTargetType,
} from '@repo/database/enums';
import { insertAdminAuditEvent } from '@repo/database/sql';
import type { BackofficeTransaction } from '../platform/database/backoffice-prisma.js';
import type { BackofficeMetrics } from '../platform/observability/backoffice-metrics.js';

/** Metadata is a flat map of fixed facts: no secret, code, token or user personal data (OA-R7). */
export type AuditMetadata = Readonly<Record<string, string | number | boolean | null>>;

export interface AdminAuditRecord {
  readonly actorType: AdminAuditActorType;
  readonly actorAccountId?: string | null;
  readonly sessionId?: string | null;
  readonly accessPath?: AdminAuditAccessPath | null;
  readonly action: AdminAuditAction;
  readonly targetType?: AdminAuditTargetType | null;
  readonly targetId?: string | null;
  readonly approvalRequestId?: string | null;
  readonly result: AdminAuditResult;
  readonly selfApproved?: boolean;
  readonly reason?: string | null;
  readonly requestId?: string | null;
  readonly metadata?: AuditMetadata | null;
}

/** Actor fields of the operator who sent this request. */
export interface AuditActor {
  readonly accountId: string;
  readonly sessionId: string;
  readonly requestId: string;
}

export function adminActor(actor: AuditActor) {
  return {
    actorType: 'ADMIN',
    actorAccountId: actor.accountId,
    sessionId: actor.sessionId,
    accessPath: 'SSM_PORT_FORWARD',
    requestId: actor.requestId,
  } as const;
}

// TypedSQL types every parameter as non-null; SQL NULL is a valid value for the optional columns.
const nullable = <T>(value: T | null | undefined): T => (value ?? null) as T;

/**
 * Writes audit rows inside the caller's transaction, so a failed audit write rolls the action
 * back (OA-R7). The insert leaves `occurredAt` to the database clock: backoffice_runtime has no
 * INSERT privilege on that column.
 */
export class AdminAuditWriter {
  constructor(private readonly metrics: BackofficeMetrics) {}

  async record(tx: BackofficeTransaction, record: AdminAuditRecord): Promise<string> {
    try {
      const [row] = await tx.$queryRawTyped(
        insertAdminAuditEvent(
          randomUUID(),
          record.actorType,
          nullable(record.actorAccountId),
          nullable(record.sessionId),
          nullable(record.accessPath),
          record.action,
          nullable(record.targetType),
          nullable(record.targetId),
          nullable(record.approvalRequestId),
          record.result,
          record.selfApproved ?? false,
          nullable(record.reason),
          nullable(record.requestId),
          nullable(record.metadata as Record<string, string | number | boolean | null> | null),
        ),
      );
      if (!row) {
        throw new Error('audit insert returned no row');
      }
      return row.id;
    } catch (error) {
      this.metrics.securityEvent('audit_write_failed');
      throw error;
    }
  }
}
