import type { DomainMetricDefinition } from '../platform/observability/metrics/domain-metrics.port.js';

/**
 * One alert rule watches every in-process background job: the last success time and the
 * failure count per job (README.md). Job-specific outcome metrics stay with their owners.
 */
export const BACKGROUND_JOB_METRIC_DEFINITIONS = [
  {
    name: 'api_background_job_last_success_timestamp_seconds',
    kind: 'gauge',
    help: 'Unix time in seconds of the last successful scheduled run of an in-process background job.',
    labelNames: ['job'],
  },
  {
    name: 'api_background_job_failures_total',
    kind: 'counter',
    help: 'Total failed scheduled runs of an in-process background job.',
    labelNames: ['job'],
  },
] as const satisfies readonly DomainMetricDefinition[];
