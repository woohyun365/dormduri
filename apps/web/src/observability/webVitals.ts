const WEB_VITAL_METRIC_NAMES = ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'] as const;

export type WebVitalMetricName = (typeof WEB_VITAL_METRIC_NAMES)[number];

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
  return WEB_VITAL_METRIC_NAMES.includes(name as WebVitalMetricName);
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

export function shouldLogWebVitals(): boolean {
  return process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG === '1';
}

export function reportWebVital(metric: WebVitalMetricInput): void {
  const sanitizedMetric = sanitizeWebVitalMetric(metric);
  if (!sanitizedMetric || !shouldLogWebVitals()) return;

  // Keep Phase 6 as a local/debug seam only. Real analytics delivery belongs to a separate plan.
  console.debug('[web-vital]', sanitizedMetric);
}
