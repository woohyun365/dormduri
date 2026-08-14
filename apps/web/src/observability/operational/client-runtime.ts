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
import { captureRuntimeException } from '../sentry/runtime-exception';

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
  const event = createRuntimeErrorEvent(input);
  const dedupeKey = `${event.source}:${event.fingerprint}:${event.recoveryAction}`;

  if (!observedFingerprints.has(dedupeKey) && config.runtimeErrorsEnabled) {
    if (observedFingerprints.size >= 100) {
      const oldest = observedFingerprints.values().next().value;
      if (oldest) observedFingerprints.delete(oldest);
    }
    observedFingerprints.add(dedupeKey);
    recordOperationalEvent(event);
  }

  if (
    input.recoveryAction === undefined &&
    (input.source === 'route_boundary' || input.source === 'global_boundary')
  ) {
    captureRuntimeException(input.error, {
      source: input.source,
      handled: input.handled ?? false,
      digestPresent: input.digestPresent ?? false,
    });
  }
}

export function initializeClientOperationalRuntime(): void {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as RuntimeWindow;
  if (runtimeWindow[CLIENT_RUNTIME_KEY]) return;
  runtimeWindow[CLIENT_RUNTIME_KEY] = true;

  operationalTelemetry.setAdapter(
    selectClientOperationalTelemetryAdapter(readClientOperationalTelemetryConfig()),
  );
}

export function resetClientOperationalRuntimeForTests(): void {
  observedFingerprints.clear();
  if (typeof window !== 'undefined') {
    delete (window as RuntimeWindow)[CLIENT_RUNTIME_KEY];
  }
}
