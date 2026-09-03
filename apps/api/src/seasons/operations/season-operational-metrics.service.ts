import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Campus, SeasonOperationAuditAction } from '../../generated/prisma/enums.js';
import {
  DOMAIN_METRICS_PORT,
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';

export type SeasonContextCacheMetricState = 'hit' | 'miss' | 'none';
export type SeasonOperationMetricOutcome =
  'success' | 'conflict' | 'not_found' | 'validation_failure' | 'audit_failure' | 'failure';

export interface SeasonCurrentQueryMetricInput {
  campusCode: Campus;
  cache: SeasonContextCacheMetricState;
  durationMs: number;
  recordedAt?: Date;
}

export interface SeasonOperationMetricInput {
  action: SeasonOperationAuditAction;
  campusCode: Campus;
  outcome: SeasonOperationMetricOutcome;
  recordedAt?: Date;
}

interface CurrentSeasonQueryMetricsSnapshot {
  total: number;
  cacheHits: number;
  cacheMisses: number;
  noCache: number;
  totalDurationMs: number;
  lastDurationMs: number;
  lastCampusCode: Campus | null;
  lastCache: SeasonContextCacheMetricState | null;
  lastRecordedAt: string | null;
}

interface SeasonOperationActionMetricsSnapshot {
  totalSuccess: number;
  totalConflict: number;
  totalNotFound: number;
  totalValidationFailure: number;
  totalAuditFailure: number;
  totalFailure: number;
  lastCampusCode: Campus | null;
  lastOutcome: SeasonOperationMetricOutcome | null;
  lastRecordedAt: string | null;
}

export interface SeasonOperationalMetricsSnapshot {
  currentSeasonQueries: CurrentSeasonQueryMetricsSnapshot;
  operations: Record<SeasonOperationAuditAction, SeasonOperationActionMetricsSnapshot>;
}

export interface SeasonOperationMetricPayload {
  action: SeasonOperationAuditAction;
  campusCode: Campus;
  outcome: SeasonOperationMetricOutcome;
  recordedAt: string;
}

const OPERATION_ACTIONS = [
  'UPDATE_SCHEDULE',
  'UPDATE_OVERRIDE',
  'CLEAR_OVERRIDE',
] as const satisfies readonly SeasonOperationAuditAction[];

const FORBIDDEN_METRIC_PAYLOAD_KEYS = new Set([
  'actor',
  'actorId',
  'actorUserId',
  'sessionId',
  'gender',
  'reason',
  'previousSnapshot',
  'nextSnapshot',
  'metadata',
  'rawToken',
]);

function emptyOperationActionMetrics(): SeasonOperationActionMetricsSnapshot {
  return {
    totalSuccess: 0,
    totalConflict: 0,
    totalNotFound: 0,
    totalValidationFailure: 0,
    totalAuditFailure: 0,
    totalFailure: 0,
    lastCampusCode: null,
    lastOutcome: null,
    lastRecordedAt: null,
  };
}

function createOperationMetrics() {
  return Object.fromEntries(
    OPERATION_ACTIONS.map((action) => [action, emptyOperationActionMetrics()]),
  ) as Record<SeasonOperationAuditAction, SeasonOperationActionMetricsSnapshot>;
}

export function assertSeasonOperationMetricPayloadSafe(payload: Record<string, unknown>) {
  const forbiddenKeys = findForbiddenMetricPayloadKeys(payload);

  if (forbiddenKeys.length > 0) {
    throw new Error(`Unsafe season operation metric payload keys: ${forbiddenKeys.join(', ')}`);
  }
}

export function toSeasonOperationMetricPayload(
  input: Required<SeasonOperationMetricInput>,
): SeasonOperationMetricPayload {
  const payload = {
    action: input.action,
    campusCode: input.campusCode,
    outcome: input.outcome,
    recordedAt: input.recordedAt.toISOString(),
  } satisfies SeasonOperationMetricPayload;

  assertSeasonOperationMetricPayloadSafe(payload);
  return payload;
}

@Injectable()
export class SeasonOperationalMetricsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_METRICS_PORT)
    private readonly domainMetrics?: DomainMetricsPort,
  ) {}

  private currentSeasonQueries: CurrentSeasonQueryMetricsSnapshot = {
    total: 0,
    cacheHits: 0,
    cacheMisses: 0,
    noCache: 0,
    totalDurationMs: 0,
    lastDurationMs: 0,
    lastCampusCode: null,
    lastCache: null,
    lastRecordedAt: null,
  };
  private readonly operations = createOperationMetrics();

  recordCurrentSeasonQuery(input: SeasonCurrentQueryMetricInput) {
    const recordedAt = input.recordedAt ?? new Date();
    const durationMs = Math.max(0, Math.floor(input.durationMs));

    this.currentSeasonQueries.total += 1;
    this.currentSeasonQueries.totalDurationMs += durationMs;
    this.currentSeasonQueries.lastDurationMs = durationMs;
    this.currentSeasonQueries.lastCampusCode = input.campusCode;
    this.currentSeasonQueries.lastCache = input.cache;
    this.currentSeasonQueries.lastRecordedAt = recordedAt.toISOString();

    if (input.cache === 'hit') {
      this.currentSeasonQueries.cacheHits += 1;
    } else if (input.cache === 'miss') {
      this.currentSeasonQueries.cacheMisses += 1;
    } else {
      this.currentSeasonQueries.noCache += 1;
    }
    recordDomainMetricSafely(this.domainMetrics, (metrics) => {
      const labels = { campus: input.campusCode, cache: input.cache };
      metrics.incrementCounter({
        name: 'api_seasons_current_query_total',
        labels,
      });
      metrics.observeHistogram({
        name: 'api_seasons_current_query_duration_seconds',
        labels,
        value: durationMs / 1000,
      });
    });
  }

  recordOperation(input: SeasonOperationMetricInput) {
    const recordedAt = input.recordedAt ?? new Date();
    const actionMetrics = this.operations[input.action];

    if (input.outcome === 'success') {
      actionMetrics.totalSuccess += 1;
    } else if (input.outcome === 'conflict') {
      actionMetrics.totalConflict += 1;
    } else if (input.outcome === 'not_found') {
      actionMetrics.totalNotFound += 1;
    } else if (input.outcome === 'validation_failure') {
      actionMetrics.totalValidationFailure += 1;
    } else if (input.outcome === 'audit_failure') {
      actionMetrics.totalAuditFailure += 1;
    } else {
      actionMetrics.totalFailure += 1;
    }

    actionMetrics.lastCampusCode = input.campusCode;
    actionMetrics.lastOutcome = input.outcome;
    actionMetrics.lastRecordedAt = recordedAt.toISOString();
    recordDomainMetricSafely(this.domainMetrics, (metrics) =>
      metrics.incrementCounter({
        name: 'api_seasons_operation_total',
        labels: {
          action: input.action,
          campus: input.campusCode,
          outcome: input.outcome,
        },
      }),
    );
  }

  snapshot(): SeasonOperationalMetricsSnapshot {
    return {
      currentSeasonQueries: { ...this.currentSeasonQueries },
      operations: Object.fromEntries(
        OPERATION_ACTIONS.map((action) => [action, { ...this.operations[action] }]),
      ) as Record<SeasonOperationAuditAction, SeasonOperationActionMetricsSnapshot>,
    };
  }
}

function findForbiddenMetricPayloadKeys(payload: unknown, path = ''): string[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return [];
  }

  return Object.entries(payload).flatMap(([key, value]) => {
    const currentPath = path ? `${path}.${key}` : key;
    const nested = findForbiddenMetricPayloadKeys(value, currentPath);

    return FORBIDDEN_METRIC_PAYLOAD_KEYS.has(key) ? [currentPath, ...nested] : nested;
  });
}
