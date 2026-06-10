import { collectRetentionBacklogSnapshot } from './retention-backlog-snapshot.query.js';
import { buildRetentionOperationalAlerts } from './retention-alerts.js';
import type {
  RetentionMetric,
  RetentionMetricName,
  RetentionObservabilitySweepEmission,
  RetentionObservabilitySweepInput,
} from './retention-observability.types.js';

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

function metric(
  name: RetentionMetricName,
  value: number,
  observedAt: string,
  tags?: Record<string, string>,
): RetentionMetric {
  return { name, value, observedAt, ...(tags ? { tags } : {}) };
}
