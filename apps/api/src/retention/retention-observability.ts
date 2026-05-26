import { Injectable, Logger } from '@nestjs/common';
import type { ManagedPrismaClient } from '../common/prisma/prisma.service.js';
import type { LifecycleSweepResult } from '../common/lifecycle/lifecycle-sweep.service.js';

export type RetentionMetricName =
  | 'retention.archive.jobs.due'
  | 'retention.archive.jobs.manual_review'
  | 'retention.archive.jobs.retry_exhausted'
  | 'retention.review.jobs.due'
  | 'retention.review.jobs.manual_review'
  | 'retention.vault.objects.retained'
  | 'retention.vault.objects.disposed'
  | 'retention.identity.disposal.due'
  | 'retention.access_log.disposal.due'
  | 'retention.access_log.disposed'
  | 'retention.sweep.duration_ms'
  | 'retention.key.unavailable';

export type RetentionOperationalAlertType =
  | 'RETENTION_ARCHIVE_MANUAL_REVIEW'
  | 'RETENTION_REVIEW_MANUAL_REVIEW'
  | 'RETENTION_RETRY_EXHAUSTED'
  | 'RETENTION_KEY_UNAVAILABLE'
  | 'RETENTION_BACKLOG_THRESHOLD_EXCEEDED'
  | 'RETENTION_SWEEP_FAILED';

export interface RetentionMetric {
  name: RetentionMetricName;
  value: number;
  observedAt: string;
  tags?: Record<string, string>;
}

export interface RetentionOperationalAlert {
  type: RetentionOperationalAlertType;
  severity: 'warning' | 'critical';
  message: string;
  observedAt: string;
  count?: number;
  metadata?: Record<string, unknown>;
}

export interface RetentionBacklogSnapshot {
  archiveDueCount: number;
  archiveManualReviewCount: number;
  archiveRetryExhaustedCount: number;
  retentionReviewDueCount: number;
  retentionReviewManualReviewCount: number;
  retainedVaultObjectCount: number;
  disposedVaultObjectCount: number;
  retainedIdentityDisposalDueCount: number;
  accessLogDisposalDueCount: number;
  keyUnavailableCount: number;
}

export interface RetentionObservabilitySweepInput {
  prisma: Pick<
    ManagedPrismaClient,
    | 'archiveJob'
    | 'retentionReviewJob'
    | 'retainedVaultObject'
    | 'retainedIdentity'
    | 'retentionAccessLog'
  >;
  result: LifecycleSweepResult;
  now: Date;
  durationMs: number;
}

export interface RetentionObservabilitySweepEmission {
  metrics: RetentionMetric[];
  alerts: RetentionOperationalAlert[];
  snapshot: RetentionBacklogSnapshot;
}

const RETENTION_BACKLOG_ALERT_THRESHOLD = 100;

@Injectable()
export class RetentionObservabilityService {
  private readonly logger = new Logger(RetentionObservabilityService.name);

  async emitSweep(input: RetentionObservabilitySweepInput) {
    const emission = await buildRetentionSweepEmission(input);

    for (const metric of emission.metrics) {
      this.logger.log({ event: 'retention.metric', ...metric });
    }

    for (const alert of emission.alerts) {
      if (alert.severity === 'critical') {
        this.logger.error({ event: 'retention.alert', ...alert });
      } else {
        this.logger.warn({ event: 'retention.alert', ...alert });
      }
    }

    return emission;
  }

  emitSweepFailure(input: { mode: 'periodic' | 'boundary'; error: unknown; occurredAt?: Date }) {
    const alert: RetentionOperationalAlert = {
      type: 'RETENTION_SWEEP_FAILED',
      severity: 'critical',
      message: 'Retention lifecycle sweep failed before completion.',
      observedAt: (input.occurredAt ?? new Date()).toISOString(),
      metadata: {
        mode: input.mode,
        errorMessage: input.error instanceof Error ? input.error.message : String(input.error),
      },
    };
    this.logger.error({ event: 'retention.alert', ...alert });
    return alert;
  }
}

export async function buildRetentionSweepEmission(
  input: RetentionObservabilitySweepInput,
): Promise<RetentionObservabilitySweepEmission> {
  const snapshot = await collectRetentionBacklogSnapshot(input.prisma, input.now);
  const observedAt = input.now.toISOString();
  const metrics: RetentionMetric[] = [
    metric('retention.archive.jobs.due', snapshot.archiveDueCount, observedAt),
    metric('retention.archive.jobs.manual_review', snapshot.archiveManualReviewCount, observedAt),
    metric(
      'retention.archive.jobs.retry_exhausted',
      snapshot.archiveRetryExhaustedCount,
      observedAt,
    ),
    metric('retention.review.jobs.due', snapshot.retentionReviewDueCount, observedAt),
    metric(
      'retention.review.jobs.manual_review',
      snapshot.retentionReviewManualReviewCount,
      observedAt,
    ),
    metric('retention.vault.objects.retained', snapshot.retainedVaultObjectCount, observedAt),
    metric('retention.vault.objects.disposed', snapshot.disposedVaultObjectCount, observedAt),
    metric(
      'retention.identity.disposal.due',
      snapshot.retainedIdentityDisposalDueCount,
      observedAt,
    ),
    metric('retention.access_log.disposal.due', snapshot.accessLogDisposalDueCount, observedAt),
    metric(
      'retention.access_log.disposed',
      input.result.retentionAccessLogDisposalSweep.processedCount,
      observedAt,
    ),
    metric('retention.sweep.duration_ms', input.durationMs, observedAt),
    metric('retention.key.unavailable', snapshot.keyUnavailableCount, observedAt),
  ];

  return {
    snapshot,
    metrics,
    alerts: buildRetentionOperationalAlerts(snapshot, observedAt),
  };
}

export async function collectRetentionBacklogSnapshot(
  prisma: RetentionObservabilitySweepInput['prisma'],
  now: Date,
): Promise<RetentionBacklogSnapshot> {
  const [
    archiveDueCount,
    archiveManualReviewRows,
    retentionReviewDueCount,
    retentionReviewManualReviewRows,
    retainedVaultObjectCount,
    disposedVaultObjectCount,
    retainedIdentityDisposalDueCount,
    accessLogDisposalDueCount,
  ] = await Promise.all([
    prisma.archiveJob.count({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        nextRunAt: { lte: now },
      },
    }),
    prisma.archiveJob.findMany({
      where: {
        OR: [{ status: 'FAILED_MANUAL_REVIEW' }, { manualReviewRequired: true }],
      },
      select: { attemptCount: true, maxAttempts: true, lastErrorCode: true },
    }),
    prisma.retentionReviewJob.count({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        dueAt: { lte: now },
      },
    }),
    prisma.retentionReviewJob.findMany({
      where: {
        OR: [{ status: 'FAILED_MANUAL_REVIEW' }, { manualReviewRequired: true }],
      },
      select: { attemptCount: true, maxAttempts: true, lastErrorCode: true },
    }),
    prisma.retainedVaultObject.count({ where: { state: 'RETAINED' } }),
    prisma.retainedVaultObject.count({ where: { state: 'DISPOSED' } }),
    prisma.retainedIdentity.count({
      where: {
        retentionDisposedAt: null,
        holds: {
          some: {},
          every: {
            OR: [{ releasedAt: { not: null } }, { holdUntil: { not: null, lte: now } }],
          },
        },
      },
    }),
    prisma.retentionAccessLog.count({
      where: {
        logRetentionDisposedAt: null,
        logRetentionHoldUntil: { not: null, lte: now },
      },
    }),
  ]);

  const manualRows = [...archiveManualReviewRows, ...retentionReviewManualReviewRows];
  return {
    archiveDueCount,
    archiveManualReviewCount: archiveManualReviewRows.length,
    archiveRetryExhaustedCount: archiveManualReviewRows.filter(isRetryExhausted).length,
    retentionReviewDueCount,
    retentionReviewManualReviewCount: retentionReviewManualReviewRows.length,
    retainedVaultObjectCount,
    disposedVaultObjectCount,
    retainedIdentityDisposalDueCount,
    accessLogDisposalDueCount,
    keyUnavailableCount: manualRows.filter(hasKeyUnavailableError).length,
  };
}

export function buildRetentionOperationalAlerts(
  snapshot: RetentionBacklogSnapshot,
  observedAt: string,
): RetentionOperationalAlert[] {
  const alerts: RetentionOperationalAlert[] = [];

  if (snapshot.archiveManualReviewCount > 0) {
    alerts.push({
      type: 'RETENTION_ARCHIVE_MANUAL_REVIEW',
      severity: 'warning',
      message: 'Archive jobs require manual retention review.',
      observedAt,
      count: snapshot.archiveManualReviewCount,
    });
  }

  if (snapshot.retentionReviewManualReviewCount > 0) {
    alerts.push({
      type: 'RETENTION_REVIEW_MANUAL_REVIEW',
      severity: 'warning',
      message: 'Retention review jobs require manual review.',
      observedAt,
      count: snapshot.retentionReviewManualReviewCount,
    });
  }

  if (snapshot.archiveRetryExhaustedCount > 0) {
    alerts.push({
      type: 'RETENTION_RETRY_EXHAUSTED',
      severity: 'critical',
      message: 'Retention archive retry budget is exhausted.',
      observedAt,
      count: snapshot.archiveRetryExhaustedCount,
    });
  }

  if (snapshot.keyUnavailableCount > 0) {
    alerts.push({
      type: 'RETENTION_KEY_UNAVAILABLE',
      severity: 'critical',
      message: 'Retention encryption/decryption key is unavailable.',
      observedAt,
      count: snapshot.keyUnavailableCount,
    });
  }

  pushBacklogAlert(alerts, observedAt, 'archiveDueCount', snapshot.archiveDueCount);
  pushBacklogAlert(alerts, observedAt, 'retentionReviewDueCount', snapshot.retentionReviewDueCount);
  pushBacklogAlert(
    alerts,
    observedAt,
    'retainedIdentityDisposalDueCount',
    snapshot.retainedIdentityDisposalDueCount,
  );
  pushBacklogAlert(
    alerts,
    observedAt,
    'accessLogDisposalDueCount',
    snapshot.accessLogDisposalDueCount,
  );

  return alerts;
}

function metric(
  name: RetentionMetricName,
  value: number,
  observedAt: string,
  tags?: Record<string, string>,
): RetentionMetric {
  return { name, value, observedAt, ...(tags ? { tags } : {}) };
}

function isRetryExhausted(row: { attemptCount: number; maxAttempts: number }) {
  return row.attemptCount >= row.maxAttempts;
}

function hasKeyUnavailableError(row: { lastErrorCode: string | null }) {
  return row.lastErrorCode?.includes('KEY_UNAVAILABLE') ?? false;
}

function pushBacklogAlert(
  alerts: RetentionOperationalAlert[],
  observedAt: string,
  backlogName: keyof Pick<
    RetentionBacklogSnapshot,
    | 'archiveDueCount'
    | 'retentionReviewDueCount'
    | 'retainedIdentityDisposalDueCount'
    | 'accessLogDisposalDueCount'
  >,
  count: number,
) {
  if (count <= RETENTION_BACKLOG_ALERT_THRESHOLD) {
    return;
  }

  alerts.push({
    type: 'RETENTION_BACKLOG_THRESHOLD_EXCEEDED',
    severity: 'warning',
    message: 'Retention lifecycle backlog exceeded the operational threshold.',
    observedAt,
    count,
    metadata: {
      backlogName,
      threshold: RETENTION_BACKLOG_ALERT_THRESHOLD,
    },
  });
}
