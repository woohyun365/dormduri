import type { NextRequest } from 'next/server';
import { createOperationalEventEnvelope } from '@/observability/operational/operational-context';
import type {
  OperationalDeviceClass,
  OperationalRouteGroup,
  WebBffRequestCompletedEvent,
} from '@/observability/operational/operational-events';
import { recordServerOperationalEvent } from '@/observability/operational/server-runtime';
import { stableOperationalSample } from '@/observability/operational/sampling';
import { getWebEnv } from '@/config/env';

const SAFE_OPERATION_PATTERN = /^[a-z][a-z0-9_.-]{1,79}$/;

export type BffReliabilityOutcome = WebBffRequestCompletedEvent['outcome'];

function createRequestId(): string {
  return globalThis.crypto.randomUUID();
}

function classifyDeviceClass(userAgent: string | undefined): OperationalDeviceClass {
  if (!userAgent) return 'desktop';
  if (/ipad|tablet|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function routeGroupFromOperation(operation: string): OperationalRouteGroup {
  if (operation.startsWith('auth.login') || operation.startsWith('auth.session')) return 'login';
  if (operation.startsWith('auth.signup')) return 'signup';
  if (operation.startsWith('auth.password_reset')) return 'password_reset';
  if (operation.startsWith('roommate') || operation.startsWith('profile')) return 'main_roommate';
  if (operation.startsWith('match')) return 'main_matching';
  if (operation.startsWith('chat')) return 'main_chat';
  if (operation.startsWith('home')) return 'main_home';
  return 'other';
}

function statusClass(status: number | undefined): WebBffRequestCompletedEvent['statusClass'] {
  if (status === undefined) return 'none';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 200) return '2xx';
  return 'none';
}

export function normalizeBffOperation(operation: string | undefined): string {
  if (!operation || !SAFE_OPERATION_PATTERN.test(operation)) return 'generic.request';
  return operation;
}

export type BffReliabilityMeasurement = Readonly<{
  requestId: string;
  correlationHeaders: Readonly<Record<'x-request-id', string>>;
  complete(input: { outcome: BffReliabilityOutcome; status?: number }): void;
}>;

export function startBffReliabilityMeasurement(input: {
  operation?: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  authenticated: boolean;
  request?: NextRequest;
  userAgent?: string;
}): BffReliabilityMeasurement {
  const startedAt = performance.now();
  const requestId = createRequestId();
  const operation = normalizeBffOperation(input.operation);
  let completed = false;

  return {
    requestId,
    correlationHeaders: { 'x-request-id': requestId },
    complete: ({ outcome, status }) => {
      if (completed) return;
      completed = true;

      const env = getWebEnv().operationalTelemetry;
      if (!env.bffStructuredLoggingEnabled) return;
      if (outcome === 'success' && !stableOperationalSample(requestId, env.bffSuccessSampleRate)) {
        return;
      }
      const userAgent = input.userAgent ?? input.request?.headers.get('user-agent') ?? undefined;
      recordServerOperationalEvent({
        ...createOperationalEventEnvelope({
          pathname: '/',
          environment: env.environment,
          release: env.release,
        }),
        routeGroup: routeGroupFromOperation(operation),
        deviceClass: classifyDeviceClass(userAgent),
        eventName: 'web_bff_request_completed',
        operation,
        method: input.method,
        outcome,
        statusClass: statusClass(status),
        durationMs: Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100),
        authenticated: input.authenticated,
        requestCorrelationPresent: true,
        requestId,
      });
    },
  };
}
