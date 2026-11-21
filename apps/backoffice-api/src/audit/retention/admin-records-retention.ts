import {
  anonymizeDeactivatedAdminAccounts,
  pruneEndedAdminInvitations,
  pruneEndedAdminSessions,
  pruneEndedAdminWebAuthnChallenges,
  purgeClosedAdminApprovalRequests,
  purgeExpiredAdminAuditEvents,
  purgeRevokedAdminRoleAssignments,
} from '@repo/database/sql';
import type { BackofficeRetentionPrisma } from '../../platform/database/backoffice-prisma.js';
import type { BackofficeLogger } from '../../platform/observability/backoffice-logger.js';
import type {
  BackofficeMetrics,
  RetentionStep,
} from '../../platform/observability/backoffice-metrics.js';
import { DAY_MS } from '../../platform/time/clock.js';

export const AUDIT_RETENTION_YEARS = 3;
export const ENDED_AUTH_STATE_RETENTION_MS = 7 * DAY_MS;
export const RETENTION_BATCH_SIZE = 500;
// A run stops a step after this many full batches and the next run continues (bounded work).
const MAX_BATCHES_PER_STEP = 200;

export interface RetentionCutoffs {
  /** DR-R5: three calendar years before the database clock. */
  readonly records: Date;
  /** DR-R6: seven days before the database clock. */
  readonly endedAuthState: Date;
  readonly now: Date;
}

export function retentionCutoffs(now: Date): RetentionCutoffs {
  const records = new Date(now.getTime());
  records.setUTCFullYear(records.getUTCFullYear() - AUDIT_RETENTION_YEARS);
  return { records, endedAuthState: new Date(now.getTime() - ENDED_AUTH_STATE_RETENTION_MS), now };
}

interface RetentionStepDefinition {
  readonly step: RetentionStep;
  readonly run: (
    prisma: BackofficeRetentionPrisma,
    cutoffs: RetentionCutoffs,
    limit: number,
  ) => Promise<number>;
}

const count = (rows: readonly { deletedCount: number | null }[]) => rows[0]?.deletedCount ?? 0;

/**
 * Order matters (README §5, DR-R5, DR-R6): audit rows first, then the revoked role assignments and closed approval
 * requests no remaining audit row points at, then anonymization of deactivated accounts whose last
 * audit row is gone, then the 7-day cleanup of sessions, challenges and invitations. Every step is
 * one conditional statement per batch, so a second run, or two containers overlapping during a
 * rollout, finds nothing left to change and ends in the same state.
 */
export const RETENTION_STEP_ORDER: readonly RetentionStepDefinition[] = [
  {
    step: 'audit_events',
    run: async (prisma, cutoffs, limit) =>
      count(await prisma.$queryRawTyped(purgeExpiredAdminAuditEvents(cutoffs.records, limit))),
  },
  {
    step: 'role_assignments',
    run: async (prisma, cutoffs, limit) =>
      count(await prisma.$queryRawTyped(purgeRevokedAdminRoleAssignments(cutoffs.records, limit))),
  },
  {
    step: 'approval_requests',
    run: async (prisma, cutoffs, limit) =>
      count(await prisma.$queryRawTyped(purgeClosedAdminApprovalRequests(cutoffs.records, limit))),
  },
  {
    step: 'account_anonymization',
    run: async (prisma, cutoffs, limit) =>
      (await prisma.$queryRawTyped(anonymizeDeactivatedAdminAccounts(cutoffs.now, limit))).length,
  },
  {
    step: 'sessions',
    run: async (prisma, cutoffs, limit) =>
      count(await prisma.$queryRawTyped(pruneEndedAdminSessions(cutoffs.endedAuthState, limit))),
  },
  {
    step: 'webauthn_challenges',
    run: async (prisma, cutoffs, limit) =>
      count(
        await prisma.$queryRawTyped(
          pruneEndedAdminWebAuthnChallenges(cutoffs.endedAuthState, limit),
        ),
      ),
  },
  {
    step: 'invitations',
    run: async (prisma, cutoffs, limit) =>
      count(await prisma.$queryRawTyped(pruneEndedAdminInvitations(cutoffs.endedAuthState, limit))),
  },
];

export type RetentionRunResult =
  | { readonly ok: true; readonly processed: Readonly<Record<RetentionStep, number>> }
  | {
      readonly ok: false;
      readonly failedStep: RetentionStep;
      readonly processed: Partial<Record<RetentionStep, number>>;
    };

/**
 * The backoffice records cleanup job (data-retention.md DR-R5·DR-R6). It connects only as
 * `dormduri_backoffice_retention`; the user API knows nothing of the backoffice tables.
 */
export class AdminRecordsRetention {
  constructor(
    private readonly prisma: BackofficeRetentionPrisma,
    private readonly metrics: BackofficeMetrics,
    private readonly logger: BackofficeLogger,
    private readonly steps: readonly RetentionStepDefinition[] = RETENTION_STEP_ORDER,
    private readonly batchSize = RETENTION_BATCH_SIZE,
  ) {}

  async runOnce(): Promise<RetentionRunResult> {
    const now = await this.prisma.databaseNow();
    const cutoffs = retentionCutoffs(now);
    const processed: Partial<Record<RetentionStep, number>> = {};
    for (const definition of this.steps) {
      try {
        let total = 0;
        for (let batch = 0; batch < MAX_BATCHES_PER_STEP; batch += 1) {
          const rows = await definition.run(this.prisma, cutoffs, this.batchSize);
          total += rows;
          if (rows < this.batchSize) {
            break;
          }
        }
        processed[definition.step] = total;
        this.metrics.retentionProcessed(definition.step, total);
      } catch (error) {
        // Later steps depend on the earlier ones, so the run stops here and the next run retries.
        this.metrics.retentionFailed(definition.step, now);
        this.logger.event('error', 'backoffice_retention_step_failed', {
          step: definition.step,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        return { ok: false, failedStep: definition.step, processed };
      }
    }
    this.metrics.retentionSucceeded(now);
    this.logger.event('info', 'backoffice_retention_run_succeeded', { processed });
    return { ok: true, processed: processed as Record<RetentionStep, number> };
  }
}
