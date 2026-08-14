import * as Sentry from '@sentry/nextjs';
import {
  resolveOperationalDeviceClass,
  resolveOperationalRouteGroup,
} from '../operational/operational-context';
import { normalizeOperationalErrorType } from '../operational/error-fingerprint';
import { readSentryRuntimeConfig, type SentryRuntimeKind } from './config';

export type SanitizedRuntimeContext = Readonly<{
  source: 'route_boundary' | 'global_boundary';
  runtime?: SentryRuntimeKind;
  handled: boolean;
  digestPresent: boolean;
  recoveryAction?: 'retry' | 'reload' | 'navigate_home' | 'none';
}>;

const capturedErrors = new WeakSet<Error>();

export function captureRuntimeException(
  error: unknown,
  context: SanitizedRuntimeContext,
): string | undefined {
  if (!(error instanceof Error)) return undefined;
  try {
    const config = readSentryRuntimeConfig(context.runtime ?? 'client');
    if (!config.captureEnabled || !config.runtimeErrorsEnabled || capturedErrors.has(error)) {
      return undefined;
    }

    capturedErrors.add(error);
    let eventId: string | undefined;
    Sentry.withScope((scope) => {
      scope.setTags({
        routeGroup: resolveOperationalRouteGroup(
          typeof location === 'undefined' ? undefined : location.pathname,
        ),
        deviceClass: resolveOperationalDeviceClass(
          typeof window === 'undefined' ? 1280 : window.innerWidth,
        ),
        runtime: context.runtime ?? 'client',
        source: context.source,
        handled: String(context.handled),
        digestPresent: String(context.digestPresent),
        recoveryAction: context.recoveryAction ?? 'none',
      });
      scope.setFingerprint([normalizeOperationalErrorType(error), context.source]);
      eventId = Sentry.captureException(error);
    });
    return eventId;
  } catch {
    return undefined;
  }
}
