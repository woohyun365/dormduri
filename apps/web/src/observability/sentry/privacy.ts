import type * as Sentry from '@sentry/nextjs';
import {
  isOperationalDeviceClass,
  isOperationalRouteGroup,
  resolveOperationalRouteGroup,
} from '../operational/operational-context';
import { normalizeOperationalErrorType } from '../operational/error-fingerprint';

// Derive callback/event types from the installed SDK so the privacy boundary
// stays compatible without exposing provider types to feature code.
type SentryOptions = Parameters<typeof Sentry.init>[0];
type BeforeSend = NonNullable<SentryOptions['beforeSend']>;
type BeforeBreadcrumb = NonNullable<SentryOptions['beforeBreadcrumb']>;
type BeforeSendTransaction = NonNullable<SentryOptions['beforeSendTransaction']>;
type BeforeSendSpan = NonNullable<SentryOptions['beforeSendSpan']>;

type ErrorEvent = Parameters<BeforeSend>[0];
type EventHint = Parameters<BeforeSend>[1];
type Breadcrumb = Parameters<BeforeBreadcrumb>[0];
type TransactionEvent = Parameters<BeforeSendTransaction>[0];
type SpanJSON = Parameters<BeforeSendSpan>[0];

const ALLOWED_RUNTIME_KINDS = new Set(['client', 'node', 'edge']);
const ALLOWED_SOURCES = new Set(['route_boundary', 'global_boundary']);
const ALLOWED_RECOVERY_ACTIONS = new Set(['retry', 'reload', 'navigate_home', 'none']);
const ALLOWED_BREADCRUMB_CATEGORIES = new Set(['ui.click', 'navigation', 'sentry.event']);
const ALLOWED_MEASUREMENTS = new Set(['lcp', 'inp', 'cls', 'ttfb', 'fcp']);

function boundedString(value: unknown, allowed: ReadonlySet<string>): string | undefined {
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function sanitizeTags(tags: ErrorEvent['tags']): ErrorEvent['tags'] {
  if (!tags) return undefined;
  const routeGroup = isOperationalRouteGroup(tags.routeGroup) ? tags.routeGroup : undefined;
  const deviceClass = isOperationalDeviceClass(tags.deviceClass) ? tags.deviceClass : undefined;
  const runtime = boundedString(tags.runtime, ALLOWED_RUNTIME_KINDS);
  const source = boundedString(tags.source, ALLOWED_SOURCES);
  const recoveryAction = boundedString(tags.recoveryAction, ALLOWED_RECOVERY_ACTIONS);
  const handled = tags.handled === 'true' || tags.handled === 'false' ? tags.handled : undefined;
  const digestPresent =
    tags.digestPresent === 'true' || tags.digestPresent === 'false'
      ? tags.digestPresent
      : undefined;

  return Object.fromEntries(
    Object.entries({
      routeGroup,
      deviceClass,
      runtime,
      source,
      handled,
      digestPresent,
      recoveryAction,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function sanitizeContexts(contexts: ErrorEvent['contexts']): ErrorEvent['contexts'] {
  const trace = contexts?.trace;
  if (!trace) return undefined;
  return {
    trace: {
      trace_id: trace.trace_id,
      span_id: trace.span_id,
      parent_span_id: trace.parent_span_id,
      op: trace.op,
      status: trace.status,
      origin: trace.origin,
    },
  };
}

function sanitizeSourceLocation(value: string | undefined): string | undefined {
  return value?.split(/[?#]/u, 1)[0];
}

function sanitizeException(event: ErrorEvent, hint: EventHint): ErrorEvent['exception'] {
  const originalError =
    hint.originalException instanceof Error ? hint.originalException : undefined;
  if (!event.exception?.values) return undefined;
  const normalizedErrorType = normalizeOperationalErrorType(originalError);
  const safeErrorType = normalizedErrorType === 'unknown' ? 'Error' : normalizedErrorType;

  return {
    values: event.exception.values.map((value) => ({
      type: safeErrorType,
      value: safeErrorType,
      mechanism: value.mechanism
        ? {
            type: value.mechanism.type,
            handled: value.mechanism.handled,
          }
        : undefined,
      stacktrace: value.stacktrace
        ? {
            frames: value.stacktrace.frames?.map((frame) => ({
              filename: sanitizeSourceLocation(frame.filename),
              abs_path: sanitizeSourceLocation(frame.abs_path),
              function: frame.function,
              module: frame.module,
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app,
            })),
          }
        : undefined,
    })),
  };
}

function sanitizeSpan(span: SpanJSON): SpanJSON {
  return {
    span_id: span.span_id,
    trace_id: span.trace_id,
    parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp,
    timestamp: span.timestamp,
    status: span.status,
    op: span.op,
    origin: span.origin,
    data: {},
  };
}

export function scrubSentryErrorEvent(event: ErrorEvent, hint: EventHint): ErrorEvent {
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    transaction: event.transaction ? resolveOperationalRouteGroup(event.transaction) : undefined,
    tags: sanitizeTags(event.tags),
    contexts: sanitizeContexts(event.contexts),
    exception: sanitizeException(event, hint),
    breadcrumbs: event.breadcrumbs
      ?.map(scrubSentryBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null),
  };
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (
    breadcrumb.category === 'console' ||
    breadcrumb.type === 'http' ||
    !breadcrumb.category ||
    !ALLOWED_BREADCRUMB_CATEGORIES.has(breadcrumb.category)
  ) {
    return null;
  }
  return {
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type,
    category: breadcrumb.category,
    level: breadcrumb.level,
  };
}

export function scrubSentryTransaction(event: TransactionEvent): TransactionEvent {
  return {
    type: 'transaction',
    event_id: event.event_id,
    timestamp: event.timestamp,
    start_timestamp: event.start_timestamp,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    transaction: resolveOperationalRouteGroup(event.transaction),
    transaction_info: event.transaction_info,
    tags: sanitizeTags(event.tags),
    contexts: sanitizeContexts(event.contexts),
    spans: event.spans?.map(sanitizeSpan),
    measurements: event.measurements
      ? Object.fromEntries(
          Object.entries(event.measurements).filter(([key]) => ALLOWED_MEASUREMENTS.has(key)),
        )
      : undefined,
  };
}

export function scrubSentrySpan(span: SpanJSON): SpanJSON {
  return sanitizeSpan(span);
}
