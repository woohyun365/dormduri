import type { DomainMetricDefinition } from '../../platform/observability/metrics/domain-metrics.port.js';

export const LEGAL_DOCUMENT_READS_METRIC = 'api_legal_document_reads_total';

/** Public legal reading: which endpoint, whether the database or the in-memory versions answered, and the outcome. */
export const LEGAL_METRIC_DEFINITIONS = [
  {
    name: LEGAL_DOCUMENT_READS_METRIC,
    kind: 'counter',
    help: 'Total public legal document reads by endpoint, read source and outcome.',
    labelNames: ['endpoint', 'source', 'outcome'],
  },
] as const satisfies readonly DomainMetricDefinition[];

export type LegalReadEndpoint =
  'active' | 'active-bundle' | 'page' | 'comparison' | 'revision-notices';
export type LegalReadSource = 'database' | 'memory';
export type LegalReadOutcome = 'ok' | 'not_found' | 'unavailable';
