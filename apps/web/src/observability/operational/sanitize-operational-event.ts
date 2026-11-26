import {
  OPERATIONAL_EVENT_NAMES,
  OPERATIONAL_EVENT_SCHEMA_VERSION,
  OPERATIONAL_FORBIDDEN_KEY_PARTS,
  type OperationalEvent,
} from './operational-events';
import {
  isOperationalDeviceClass,
  isOperationalEnvironment,
  isOperationalRouteGroup,
} from './operational-context';

const LEGAL_DOCUMENT_KINDS = [
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY',
  'PERSONAL_DATA_COLLECTION_USE_CONSENT',
  'AGE_14_OR_ABOVE_NOTICE',
];
const LEGAL_EVENT_VERSION_KEY = /^(?:current|\d{4}-\d{2}-\d{2})$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

type SanitizationOptions = Readonly<{
  allowLogCorrelationFields?: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

function containsForbiddenKey(value: unknown, options: SanitizationOptions): boolean {
  if (Array.isArray(value)) return value.some((item) => containsForbiddenKey(item, options));
  if (!isRecord(value)) return false;

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    const isAllowedRequestId =
      options.allowLogCorrelationFields === true && normalized === 'requestid';
    if (
      !isAllowedRequestId &&
      OPERATIONAL_FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part))
    ) {
      return true;
    }
    if (containsForbiddenKey(child, options)) return true;
  }
  return false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasValidEnvelope(value: Record<string, unknown>): boolean {
  return (
    value.schemaVersion === OPERATIONAL_EVENT_SCHEMA_VERSION &&
    isNonEmptyString(value.occurredAt) &&
    isOperationalEnvironment(value.environment) &&
    isNonEmptyString(value.release) &&
    isOperationalRouteGroup(value.routeGroup) &&
    isOperationalDeviceClass(value.deviceClass)
  );
}

export function sanitizeOperationalEvent(
  value: unknown,
  options: SanitizationOptions = {},
): OperationalEvent | null {
  if (!isRecord(value) || containsForbiddenKey(value, options) || !hasValidEnvelope(value)) {
    return null;
  }

  if (!OPERATIONAL_EVENT_NAMES.includes(value.eventName as OperationalEvent['eventName'])) {
    return null;
  }

  if (value.eventName === 'web_runtime_error') {
    const sourceValues = [
      'route_boundary',
      'global_boundary',
      'window_error',
      'unhandled_rejection',
    ];
    const actionValues = ['retry', 'reload', 'navigate_home', 'none'];
    const outcomeValues = ['succeeded', 'failed', 'abandoned', 'unknown'];
    if (
      !sourceValues.includes(String(value.source)) ||
      !['fatal', 'error'].includes(String(value.severity)) ||
      !isNonEmptyString(value.errorType) ||
      !isNonEmptyString(value.fingerprint) ||
      typeof value.digestPresent !== 'boolean' ||
      typeof value.handled !== 'boolean' ||
      !actionValues.includes(String(value.recoveryAction)) ||
      !outcomeValues.includes(String(value.recoveryOutcome))
    ) {
      return null;
    }
    return value as OperationalEvent;
  }

  if (value.eventName === 'web_bff_request_completed') {
    const outcomes = [
      'success',
      'client_error',
      'upstream_error',
      'timeout',
      'network',
      'aborted',
      'invalid_response',
      'invalid_config',
    ];
    if (
      !isNonEmptyString(value.operation) ||
      !['GET', 'POST', 'PATCH', 'DELETE'].includes(String(value.method)) ||
      !outcomes.includes(String(value.outcome)) ||
      !['2xx', '4xx', '5xx', 'none'].includes(String(value.statusClass)) ||
      !isFiniteNumber(value.durationMs) ||
      typeof value.authenticated !== 'boolean' ||
      typeof value.requestCorrelationPresent !== 'boolean' ||
      (value.requestId !== undefined &&
        (!options.allowLogCorrelationFields || !isNonEmptyString(value.requestId)))
    ) {
      return null;
    }
    return value as OperationalEvent;
  }

  if (value.eventName === 'web_legal_last_success') {
    const served = value.action === 'served';
    const revisionNotices = value.endpoint === 'revision-notices';
    if (
      !['served', 'write_failed'].includes(String(value.action)) ||
      !['page', 'comparison', 'revision-notices'].includes(String(value.endpoint)) ||
      (revisionNotices
        ? value.documentKind !== 'all' || value.versionKey !== 'all'
        : !LEGAL_DOCUMENT_KINDS.includes(String(value.documentKind)) ||
          !LEGAL_EVENT_VERSION_KEY.test(String(value.versionKey))) ||
      (served
        ? typeof value.checkedAt !== 'string' || !ISO_INSTANT.test(value.checkedAt)
        : value.checkedAt !== undefined)
    ) {
      return null;
    }
    return value as OperationalEvent;
  }

  if (value.eventName === 'web_vital_measured') {
    if (
      !['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].includes(String(value.metric)) ||
      !isFiniteNumber(value.value) ||
      (value.delta !== undefined && !isFiniteNumber(value.delta)) ||
      !isNonEmptyString(value.metricId) ||
      !Array.isArray(value.attributionKeys) ||
      !value.attributionKeys.every((key) => typeof key === 'string')
    ) {
      return null;
    }
    return value as OperationalEvent;
  }

  return null;
}
