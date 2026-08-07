import { readClientOperationalTelemetryConfig } from '../operational/client-config';
import { createOperationalEventEnvelope } from '../operational/operational-context';
import { recordOperationalEvent } from '../operational/operational-telemetry';
import { stableOperationalSample } from '../operational/sampling';

const SANITIZED_WEB_VITAL_METRIC_NAMES = ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'] as const;
const REPORTED_WEB_VITAL_METRIC_NAMES = ['CLS', 'FCP', 'INP', 'LCP', 'TTFB'] as const;
const CORE_WEB_VITAL_METRIC_NAMES = new Set(['CLS', 'INP', 'LCP']);

export type WebVitalMetricName = (typeof SANITIZED_WEB_VITAL_METRIC_NAMES)[number];
export type ReportedWebVitalMetricName = (typeof REPORTED_WEB_VITAL_METRIC_NAMES)[number];

export type WebVitalMetricInput = Readonly<{
  id: string;
  name: string;
  value: number;
  delta?: number;
  rating?: string;
  navigationType?: string;
  attribution?: unknown;
}>;

export type SanitizedWebVitalMetric = Readonly<{
  id: string;
  name: WebVitalMetricName;
  value: number;
  delta?: number;
  rating?: string;
  navigationType?: string;
  attributionKeys: string[];
}>;

function isWebVitalMetricName(name: string): name is WebVitalMetricName {
  return SANITIZED_WEB_VITAL_METRIC_NAMES.includes(name as WebVitalMetricName);
}

function isReportedMetricName(name: WebVitalMetricName): name is ReportedWebVitalMetricName {
  return REPORTED_WEB_VITAL_METRIC_NAMES.includes(name as ReportedWebVitalMetricName);
}

function sanitizeOptionalNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function sanitizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

function extractAttributionKeys(attribution: unknown): string[] {
  if (attribution === null || typeof attribution !== 'object') return [];
  return Object.keys(attribution).sort();
}

export function sanitizeWebVitalMetric(
  metric: WebVitalMetricInput,
): SanitizedWebVitalMetric | null {
  if (!isWebVitalMetricName(metric.name)) return null;
  if (!Number.isFinite(metric.value)) return null;

  return {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: sanitizeOptionalNumber(metric.delta),
    rating: sanitizeOptionalString(metric.rating),
    navigationType: sanitizeOptionalString(metric.navigationType),
    attributionKeys: extractAttributionKeys(metric.attribution),
  };
}

export function reportWebVital(metric: WebVitalMetricInput): void {
  const sanitizedMetric = sanitizeWebVitalMetric(metric);
  const config = readClientOperationalTelemetryConfig();
  if (!sanitizedMetric || !isReportedMetricName(sanitizedMetric.name) || !config.webVitalsEnabled) {
    return;
  }

  const sampleRate = CORE_WEB_VITAL_METRIC_NAMES.has(sanitizedMetric.name)
    ? config.coreWebVitalsSampleRate
    : config.supportingWebVitalsSampleRate;
  if (!stableOperationalSample(sanitizedMetric.id, sampleRate)) return;

  recordOperationalEvent({
    ...createOperationalEventEnvelope({
      pathname: typeof location === 'undefined' ? undefined : location.pathname,
      viewportWidth: typeof window === 'undefined' ? undefined : window.innerWidth,
      environment: config.environment,
      release: config.release,
    }),
    eventName: 'web_vital_measured',
    metric: sanitizedMetric.name,
    value: sanitizedMetric.value,
    delta: sanitizedMetric.delta,
    rating: sanitizedMetric.rating,
    navigationType: sanitizedMetric.navigationType,
    metricId: sanitizedMetric.id,
    attributionKeys: sanitizedMetric.attributionKeys,
  });
}
