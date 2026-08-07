import {
  selectClientOperationalTelemetryAdapter,
  readClientOperationalTelemetryConfig,
} from './client-config';
import { createOperationalEventEnvelope } from './operational-context';
import {
  createOperationalErrorFingerprint,
  normalizeOperationalErrorType,
} from './error-fingerprint';
import { operationalTelemetry, recordOperationalEvent } from './operational-telemetry';
import type { WebRuntimeErrorEvent } from './operational-events';

const CLIENT_RUNTIME_KEY = '__KNU_WEB_OPERATIONAL_RUNTIME__';
const observedFingerprints = new Set<string>();

type RuntimeWindow = Window & { [CLIENT_RUNTIME_KEY]?: boolean };

function createRuntimeErrorEvent(input: {
  error: unknown;
  source: WebRuntimeErrorEvent['source'];
  severity?: WebRuntimeErrorEvent['severity'];
  handled?: boolean;
  recoveryAction?: WebRuntimeErrorEvent['recoveryAction'];
  recoveryOutcome?: WebRuntimeErrorEvent['recoveryOutcome'];
  digestPresent?: boolean;
}): WebRuntimeErrorEvent {
  const config = readClientOperationalTelemetryConfig();
  return {
    ...createOperationalEventEnvelope({
      pathname: typeof location === 'undefined' ? undefined : location.pathname,
      viewportWidth: typeof window === 'undefined' ? undefined : window.innerWidth,
      environment: config.environment,
      release: config.release,
    }),
    eventName: 'web_runtime_error',
    source: input.source,
    severity: input.severity ?? 'error',
    errorType: normalizeOperationalErrorType(input.error),
    fingerprint: createOperationalErrorFingerprint(input.error),
    digestPresent: input.digestPresent ?? false,
    handled: input.handled ?? false,
    recoveryAction: input.recoveryAction ?? 'none',
    recoveryOutcome: input.recoveryOutcome ?? 'unknown',
  };
}

export function recordClientRuntimeError(
  input: Parameters<typeof createRuntimeErrorEvent>[0],
): void {
  const config = readClientOperationalTelemetryConfig();
  if (!config.runtimeErrorsEnabled) return;

  const event = createRuntimeErrorEvent(input);
  const dedupeKey = `${event.source}:${event.fingerprint}:${event.recoveryAction}`;
  if (observedFingerprints.has(dedupeKey)) return;
  if (observedFingerprints.size >= 100) {
    const oldest = observedFingerprints.values().next().value;
    if (oldest) observedFingerprints.delete(oldest);
  }
  observedFingerprints.add(dedupeKey);
  recordOperationalEvent(event);
}

export function initializeClientOperationalRuntime(): void {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as RuntimeWindow;
  if (runtimeWindow[CLIENT_RUNTIME_KEY]) return;
  runtimeWindow[CLIENT_RUNTIME_KEY] = true;

  const config = readClientOperationalTelemetryConfig();
  operationalTelemetry.setAdapter(selectClientOperationalTelemetryAdapter(config));
  if (!config.runtimeErrorsEnabled) return;

  window.addEventListener('error', (event) => {
    recordClientRuntimeError({
      error: event.error instanceof Error ? event.error : new Error('window_error'),
      source: 'window_error',
      handled: false,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordClientRuntimeError({
      error: event.reason,
      source: 'unhandled_rejection',
      handled: false,
    });
  });
}

export function resetClientOperationalRuntimeForTests(): void {
  observedFingerprints.clear();
  if (typeof window !== 'undefined') {
    delete (window as RuntimeWindow)[CLIENT_RUNTIME_KEY];
  }
}
