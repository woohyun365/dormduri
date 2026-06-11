import type {
  RetentionBacklogSnapshot,
  RetentionOperationalAlert,
} from './retention-observability.types.js';

export const RETENTION_BACKLOG_ALERT_THRESHOLD = 100;

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

export function buildRetentionSweepFailureAlert(input: {
  mode: 'periodic' | 'boundary';
  error: unknown;
  occurredAt?: Date;
}): RetentionOperationalAlert {
  return {
    type: 'RETENTION_SWEEP_FAILED',
    severity: 'critical',
    message: 'Retention lifecycle sweep failed before completion.',
    observedAt: (input.occurredAt ?? new Date()).toISOString(),
    metadata: {
      mode: input.mode,
      errorName: retentionObservabilityErrorName(input.error),
    },
  };
}

function retentionObservabilityErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name || 'Error';
  }
  return typeof error;
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
