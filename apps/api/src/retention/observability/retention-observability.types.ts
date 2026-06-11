import type { LifecycleSweepResult } from '../../lifecycle/lifecycle-sweep.service.js';
import type { ManagedPrismaClient } from '../../platform/database/prisma.service.js';

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
