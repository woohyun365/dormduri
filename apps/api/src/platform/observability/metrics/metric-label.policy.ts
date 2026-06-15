export const UNKNOWN_METRIC_ROUTE = 'UNKNOWN_ROUTE';

export const METRIC_FORBIDDEN_LABEL_NAMES = [
  'actorHash',
  'authorization',
  'body',
  'cookie',
  'correlationId',
  'email',
  'ip',
  'messageBody',
  'messageId',
  'params',
  'password',
  'path',
  'payload',
  'query',
  'rawPath',
  'requestBody',
  'requestId',
  'sessionId',
  'threadId',
  'token',
  'userId',
] as const;

export const HTTP_METRIC_LABEL_NAMES = ['method', 'route', 'status_class'] as const;
export const EXCEPTION_METRIC_LABEL_NAMES = ['code', 'status_class', 'domain'] as const;

export type HttpMetricLabelName = (typeof HTTP_METRIC_LABEL_NAMES)[number];
export type ExceptionMetricLabelName = (typeof EXCEPTION_METRIC_LABEL_NAMES)[number];
export type MetricStatusClass = '2xx' | '3xx' | '4xx' | '5xx';

const boundedRoutePattern = /^(UNKNOWN_ROUTE|\/[A-Za-z0-9_./:(){}*-]+)$/;
const forbiddenLabelNameSet = new Set<string>(METRIC_FORBIDDEN_LABEL_NAMES);

export class MetricLabelPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricLabelPolicyError';
  }
}

export function assertNoForbiddenMetricLabelNames(labelNames: readonly string[]): void {
  const forbidden = labelNames.filter((labelName) => forbiddenLabelNameSet.has(labelName));

  if (forbidden.length > 0) {
    throw new MetricLabelPolicyError(`Forbidden metric label names: ${forbidden.join(', ')}`);
  }
}

export function normalizeMetricMethod(method: unknown): string {
  if (typeof method !== 'string' || method.trim().length === 0) {
    return 'UNKNOWN';
  }

  return (
    method
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 16) || 'UNKNOWN'
  );
}

export function normalizeMetricRoute(route: unknown): string {
  if (typeof route !== 'string') {
    return UNKNOWN_METRIC_ROUTE;
  }

  const trimmed = route.trim();
  if (!trimmed || !boundedRoutePattern.test(trimmed)) {
    return UNKNOWN_METRIC_ROUTE;
  }

  return trimmed.replace(/\/+/g, '/');
}

export function normalizeMetricStatusClass(statusCode: number): MetricStatusClass {
  if (statusCode >= 500) {
    return '5xx';
  }
  if (statusCode >= 400) {
    return '4xx';
  }
  if (statusCode >= 300) {
    return '3xx';
  }
  return '2xx';
}

export function normalizeExceptionMetricCode(code: unknown): string {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return 'UNKNOWN_ERROR';
  }

  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_:-]/g, '_')
    .slice(0, 80);
}

export function normalizeMetricDomain(domain: unknown): string {
  if (typeof domain !== 'string' || domain.trim().length === 0) {
    return 'platform';
  }

  return domain
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 48);
}
