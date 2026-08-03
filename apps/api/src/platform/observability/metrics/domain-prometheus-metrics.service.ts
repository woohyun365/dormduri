import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Counter, Gauge, Histogram } from 'prom-client';
import observabilityConfig from '../../../config/observability.config.js';
import {
  assertDomainMetricLabelNames,
  normalizeDomainMetricLabelValue,
  type DomainMetricLabelName,
} from './metric-label.policy.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';
import type {
  DomainCounterMetricInput,
  DomainGaugeMetricInput,
  DomainHistogramMetricInput,
  DomainMetricDefinition,
  DomainMetricLabelValues,
  DomainMetricName,
  DomainMetricsPort,
} from './domain-metrics.port.js';

export const DOMAIN_METRIC_DEFINITIONS = {
  api_chat_realtime_connected_sockets: {
    name: 'api_chat_realtime_connected_sockets',
    kind: 'gauge',
    help: 'Current connected chat realtime sockets.',
    labelNames: [],
  },
  api_chat_realtime_connections_total: {
    name: 'api_chat_realtime_connections_total',
    kind: 'counter',
    help: 'Total accepted chat realtime socket connections.',
    labelNames: [],
  },
  api_realtime_dispatch_batches_total: {
    name: 'api_realtime_dispatch_batches_total',
    kind: 'counter',
    help: 'Total realtime outbox dispatcher batches by dispatcher and outcome.',
    labelNames: ['dispatcher', 'outcome'],
  },
  api_realtime_dispatch_oldest_claimed_outbox_lag_seconds: {
    name: 'api_realtime_dispatch_oldest_claimed_outbox_lag_seconds',
    kind: 'gauge',
    help: 'Oldest claimed realtime outbox lag in seconds by dispatcher.',
    labelNames: ['dispatcher'],
  },
  api_chat_realtime_rejections_total: {
    name: 'api_chat_realtime_rejections_total',
    kind: 'counter',
    help: 'Total chat realtime request/socket rejections by bounded reason and scope.',
    labelNames: ['reason', 'scope'],
  },
  api_chat_realtime_outbox_prune_total: {
    name: 'api_chat_realtime_outbox_prune_total',
    kind: 'counter',
    help: 'Total chat realtime outbox prune outcomes.',
    labelNames: ['outcome'],
  },
  api_auth_cleanup_deleted_total: {
    name: 'api_auth_cleanup_deleted_total',
    kind: 'counter',
    help: 'Total auth cleanup deleted rows by bounded target.',
    labelNames: ['target'],
  },
  api_auth_cleanup_failures_total: {
    name: 'api_auth_cleanup_failures_total',
    kind: 'counter',
    help: 'Total auth operational cleanup failures.',
    labelNames: [],
  },
  api_auth_cleanup_lag_seconds: {
    name: 'api_auth_cleanup_lag_seconds',
    kind: 'gauge',
    help: 'Last auth operational cleanup lag in seconds.',
    labelNames: [],
  },
  api_auth_credential_transitions_total: {
    name: 'api_auth_credential_transitions_total',
    kind: 'counter',
    help: 'Total auth credential transition outcomes after their owning transaction boundary.',
    labelNames: ['operation', 'outcome'],
  },
  api_auth_verification_operations_total: {
    name: 'api_auth_verification_operations_total',
    kind: 'counter',
    help: 'Total auth verification request, verify, and grant outcomes by bounded purpose.',
    labelNames: ['operation', 'outcome', 'scope'],
  },
  api_auth_mail_dispatch_total: {
    name: 'api_auth_mail_dispatch_total',
    kind: 'counter',
    help: 'Total terminal auth mail outbox dispatch outcomes.',
    labelNames: ['outcome'],
  },
  api_auth_mail_outbox_lag_seconds: {
    name: 'api_auth_mail_outbox_lag_seconds',
    kind: 'gauge',
    help: 'Oldest claimed auth mail outbox event lag in seconds.',
    labelNames: [],
  },
  api_auth_security_alert_active: {
    name: 'api_auth_security_alert_active',
    kind: 'gauge',
    help: 'Current bounded auth security alert evaluation state.',
    labelNames: ['reason'],
  },
  api_auth_redis_gate_state: {
    name: 'api_auth_redis_gate_state',
    kind: 'gauge',
    help: 'Auth Redis gate current bounded decision state.',
    labelNames: ['state'],
  },
  api_auth_login_attempts_total: {
    name: 'api_auth_login_attempts_total',
    kind: 'counter',
    help: 'Total login command outcomes by bounded result.',
    labelNames: ['outcome'],
  },
  api_auth_login_throttle_total: {
    name: 'api_auth_login_throttle_total',
    kind: 'counter',
    help: 'Total login network throttle rejections by bounded scope.',
    labelNames: ['scope'],
  },
  api_auth_login_password_verify_duration_seconds: {
    name: 'api_auth_login_password_verify_duration_seconds',
    kind: 'histogram',
    help: 'Login password verification duration seconds by safe real or dummy target.',
    labelNames: ['target'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  },
  api_auth_login_password_verify_in_flight: {
    name: 'api_auth_login_password_verify_in_flight',
    kind: 'gauge',
    help: 'Current login password verification operations by safe real or dummy target.',
    labelNames: ['target'],
  },
  api_auth_password_hash_admission_total: {
    name: 'api_auth_password_hash_admission_total',
    kind: 'counter',
    help: 'Total process-local password hash admission outcomes by bounded operation.',
    labelNames: ['operation', 'outcome'],
  },
  api_auth_password_hash_duration_seconds: {
    name: 'api_auth_password_hash_duration_seconds',
    kind: 'histogram',
    help: 'Password hash or verify duration seconds by bounded operation and target.',
    labelNames: ['operation', 'target'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  },
  api_auth_password_hash_in_flight: {
    name: 'api_auth_password_hash_in_flight',
    kind: 'gauge',
    help: 'Current process-local Argon password operations by bounded operation.',
    labelNames: ['operation'],
  },
  api_auth_password_policy_rejected_total: {
    name: 'api_auth_password_policy_rejected_total',
    kind: 'counter',
    help: 'Total new-password policy rejections by bounded operation and reason.',
    labelNames: ['operation', 'reason'],
  },
  api_auth_session_renewals_total: {
    name: 'api_auth_session_renewals_total',
    kind: 'counter',
    help: 'Total session renewal outcomes by bounded lifecycle result.',
    labelNames: ['outcome'],
  },
  api_auth_signup_nickname_validation_total: {
    name: 'api_auth_signup_nickname_validation_total',
    kind: 'counter',
    help: 'Total signup nickname validation outcomes by bounded result.',
    labelNames: ['outcome'],
  },
  api_auth_signup_final_admission_total: {
    name: 'api_auth_signup_final_admission_total',
    kind: 'counter',
    help: 'Total final signup admission outcomes before password hashing.',
    labelNames: ['outcome'],
  },
  api_auth_signup_password_hash_total: {
    name: 'api_auth_signup_password_hash_total',
    kind: 'counter',
    help: 'Total signup password hash lifecycle outcomes.',
    labelNames: ['outcome'],
  },
  api_auth_signup_password_hash_duration_seconds: {
    name: 'api_auth_signup_password_hash_duration_seconds',
    kind: 'histogram',
    help: 'Signup password hash duration seconds by bounded outcome.',
    labelNames: ['outcome'],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  },
  api_auth_sensitive_mutations_total: {
    name: 'api_auth_sensitive_mutations_total',
    kind: 'counter',
    help: 'Total protected auth mutation outcomes by bounded operation.',
    labelNames: ['operation', 'outcome'],
  },
  api_seasons_current_query_total: {
    name: 'api_seasons_current_query_total',
    kind: 'counter',
    help: 'Total current season context queries by campus and cache state.',
    labelNames: ['campus', 'cache'],
  },
  api_seasons_current_query_duration_seconds: {
    name: 'api_seasons_current_query_duration_seconds',
    kind: 'histogram',
    help: 'Current season context query duration seconds by campus and cache state.',
    labelNames: ['campus', 'cache'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  },
  api_seasons_operation_total: {
    name: 'api_seasons_operation_total',
    kind: 'counter',
    help: 'Total season operation outcomes by action, campus, and outcome.',
    labelNames: ['action', 'campus', 'outcome'],
  },
  api_retention_backlog_total: {
    name: 'api_retention_backlog_total',
    kind: 'gauge',
    help: 'Retention backlog gauge by bounded target and state.',
    labelNames: ['target', 'state'],
  },
  api_retention_sweep_duration_seconds: {
    name: 'api_retention_sweep_duration_seconds',
    kind: 'histogram',
    help: 'Retention sweep duration seconds by target and outcome.',
    labelNames: ['target', 'outcome'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  },
  api_retention_review_jobs_total: {
    name: 'api_retention_review_jobs_total',
    kind: 'counter',
    help: 'Total observed retention review jobs by target and outcome.',
    labelNames: ['target', 'outcome'],
  },
  api_prisma_pool_connections: {
    name: 'api_prisma_pool_connections',
    kind: 'gauge',
    help: 'Current Prisma managed pg pool connections by state.',
    labelNames: ['state'],
  },
  api_prisma_transaction_retries_total: {
    name: 'api_prisma_transaction_retries_total',
    kind: 'counter',
    help: 'Total Prisma serializable transaction retry outcomes.',
    labelNames: ['outcome'],
  },
  api_roommate_search_requests_total: {
    name: 'api_roommate_search_requests_total',
    kind: 'counter',
    help: 'Total roommate search requests by outcome and sort.',
    labelNames: ['outcome', 'sort'],
  },
  api_roommate_search_duration_seconds: {
    name: 'api_roommate_search_duration_seconds',
    kind: 'histogram',
    help: 'Roommate search request duration seconds by outcome and sort.',
    labelNames: ['outcome', 'sort'],
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  },
  api_roommate_search_candidate_count: {
    name: 'api_roommate_search_candidate_count',
    kind: 'histogram',
    help: 'Roommate search candidate count by pipeline phase.',
    labelNames: ['phase'],
    buckets: [0, 1, 2, 5, 10, 20, 50, 100, 250, 500],
  },
} as const satisfies Record<DomainMetricName, DomainMetricDefinition>;

type DomainMetric = Counter<string> | Gauge<string> | Histogram<string>;

type DomainMetricLabelSet = Record<string, string>;

@Injectable()
export class DomainPrometheusMetricsService implements DomainMetricsPort {
  private readonly metrics = new Map<DomainMetricName, DomainMetric>();

  constructor(
    private readonly registryService: PrometheusRegistryService,
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {
    for (const definition of Object.values(DOMAIN_METRIC_DEFINITIONS)) {
      assertDomainMetricLabelNames(definition.labelNames);
    }
  }

  incrementCounter(input: DomainCounterMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'counter');
    const metric = this.getMetric(definition) as Counter<string>;
    metric.inc(this.normalizeLabels(definition, input.labels), Math.max(0, input.value ?? 1));
  }

  setGauge(input: DomainGaugeMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'gauge');
    const metric = this.getMetric(definition) as Gauge<string>;
    metric.set(this.normalizeLabels(definition, input.labels), Math.max(0, input.value));
  }

  observeHistogram(input: DomainHistogramMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const definition = this.requireDefinition(input.name, 'histogram');
    const metric = this.getMetric(definition) as Histogram<string>;
    metric.observe(this.normalizeLabels(definition, input.labels), Math.max(0, input.value));
  }

  private requireDefinition(name: DomainMetricName, kind: DomainMetricDefinition['kind']) {
    const definition = DOMAIN_METRIC_DEFINITIONS[name];
    if (!definition || definition.kind !== kind) {
      throw new Error(`Unsupported ${kind} domain metric: ${name}`);
    }
    return definition;
  }

  private getMetric(definition: DomainMetricDefinition): DomainMetric {
    const existingMetric = this.metrics.get(definition.name);
    if (existingMetric) {
      return existingMetric;
    }

    const registry = this.registryService.getRegister();
    const metric = this.registryService.getOrCreateMetric(definition.name, (): DomainMetric => {
      const options = {
        name: definition.name,
        help: definition.help,
        labelNames: definition.labelNames,
        registers: [registry],
      };

      if (definition.kind === 'counter') {
        return new Counter(options);
      }
      if (definition.kind === 'gauge') {
        return new Gauge(options);
      }
      return new Histogram({
        ...options,
        buckets: definition.buckets ? [...definition.buckets] : undefined,
      });
    });

    this.metrics.set(definition.name, metric);
    return metric;
  }

  private normalizeLabels(
    definition: DomainMetricDefinition,
    labels: DomainMetricLabelValues = {},
  ): DomainMetricLabelSet {
    const labelNames = definition.labelNames;
    const actualLabelNames = Object.keys(labels);
    const unexpectedLabels = actualLabelNames.filter(
      (labelName) => !labelNames.includes(labelName as DomainMetricLabelName),
    );
    if (unexpectedLabels.length > 0) {
      throw new Error(
        `Unexpected labels for ${definition.name}: ${unexpectedLabels.sort().join(', ')}`,
      );
    }

    return Object.fromEntries(
      labelNames.map((labelName) => [
        labelName,
        normalizeDomainMetricLabelValue(labels[labelName]),
      ]),
    );
  }
}
