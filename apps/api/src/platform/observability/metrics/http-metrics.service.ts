import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Counter, Gauge, Histogram } from '@prometheus-io/client';
import observabilityConfig from '../observability.config.js';
import { PrometheusRegistryService } from './prometheus-registry.service.js';
import {
  EXCEPTION_METRIC_LABEL_NAMES,
  HTTP_METRIC_LABEL_NAMES,
  assertNoForbiddenMetricLabelNames,
  normalizeExceptionMetricCode,
  normalizeMetricDomain,
  normalizeMetricMethod,
  normalizeMetricRoute,
  normalizeMetricStatusClass,
} from './metric-label.policy.js';

export interface HttpRequestMetricInput {
  durationSeconds: number;
  method: string;
  route: string;
  statusCode: number;
}

export interface ExceptionMetricInput {
  code: string;
  domain?: string;
  statusCode: number;
}

@Injectable()
export class HttpMetricsService {
  private readonly requestsTotal: Counter<(typeof HTTP_METRIC_LABEL_NAMES)[number]>;
  private readonly requestDuration: Histogram<(typeof HTTP_METRIC_LABEL_NAMES)[number]>;
  private readonly requestsInFlight: Gauge<'route'>;
  private readonly exceptionsTotal: Counter<(typeof EXCEPTION_METRIC_LABEL_NAMES)[number]>;

  constructor(
    registryService: PrometheusRegistryService,
    @Inject(observabilityConfig.KEY)
    private readonly settings: ConfigType<typeof observabilityConfig>,
  ) {
    const registry = registryService.getRegister();
    assertNoForbiddenMetricLabelNames(HTTP_METRIC_LABEL_NAMES);
    assertNoForbiddenMetricLabelNames(EXCEPTION_METRIC_LABEL_NAMES);
    assertNoForbiddenMetricLabelNames(['route']);

    this.requestsTotal = registryService.getOrCreateMetric(
      'api_http_requests_total',
      () =>
        new Counter({
          name: 'api_http_requests_total',
          help: 'Total API HTTP requests by bounded route template and status class.',
          labelNames: HTTP_METRIC_LABEL_NAMES,
          registers: [registry],
        }),
    );
    this.requestDuration = registryService.getOrCreateMetric(
      'api_http_request_duration_seconds',
      () =>
        new Histogram({
          name: 'api_http_request_duration_seconds',
          help: 'API HTTP request duration seconds by bounded route template and status class.',
          buckets: settings.metricsHttpDurationBuckets,
          labelNames: HTTP_METRIC_LABEL_NAMES,
          registers: [registry],
        }),
    );
    this.requestsInFlight = registryService.getOrCreateMetric(
      'api_http_request_in_flight',
      () =>
        new Gauge({
          name: 'api_http_request_in_flight',
          help: 'Current in-flight API HTTP requests by bounded route template.',
          labelNames: ['route'],
          registers: [registry],
        }),
    );
    this.exceptionsTotal = registryService.getOrCreateMetric(
      'api_exceptions_total',
      () =>
        new Counter({
          name: 'api_exceptions_total',
          help: 'Total normalized API exceptions by safe code/status/domain labels.',
          labelNames: EXCEPTION_METRIC_LABEL_NAMES,
          registers: [registry],
        }),
    );
  }

  startRequest(route: string): () => void {
    if (!this.settings.metricsEnabled) {
      return () => undefined;
    }

    const labels = { route: normalizeMetricRoute(route) };
    this.requestsInFlight.inc(labels);

    let finished = false;
    return () => {
      if (finished) {
        return;
      }
      finished = true;
      this.requestsInFlight.dec(labels);
    };
  }

  recordRequest(input: HttpRequestMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const labels = {
      method: normalizeMetricMethod(input.method),
      route: normalizeMetricRoute(input.route),
      status_class: normalizeMetricStatusClass(input.statusCode),
    };

    this.requestsTotal.inc(labels);
    this.requestDuration.observe(labels, Math.max(0, input.durationSeconds));
  }

  recordException(input: ExceptionMetricInput): void {
    if (!this.settings.metricsEnabled) {
      return;
    }

    const labels = {
      code: normalizeExceptionMetricCode(input.code),
      domain: normalizeMetricDomain(input.domain),
      status_class: normalizeMetricStatusClass(input.statusCode),
    };

    this.exceptionsTotal.inc(labels);
  }
}
