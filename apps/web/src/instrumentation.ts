import * as Sentry from '@sentry/nextjs';
import { readSentryRuntimeConfig } from '@/observability/sentry/config';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSentryServer } = await import('@/observability/sentry/server');
    initializeSentryServer();
    return;
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { initializeSentryEdge } = await import('@/observability/sentry/edge');
    initializeSentryEdge();
  }
}

export const onRequestError: typeof Sentry.captureRequestError = (error, request, context) => {
  try {
    const runtime = process.env.NEXT_RUNTIME === 'edge' ? 'edge' : 'node';
    const config = readSentryRuntimeConfig(runtime);
    if (!config.captureEnabled || !config.runtimeErrorsEnabled) return;
    Sentry.captureRequestError(error, request, context);
  } catch {
    // Sentry request instrumentation is fail-open.
  }
};
