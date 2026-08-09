import type { BrowserOptions, NodeOptions } from '@sentry/nextjs';
import { createRecordingSentryTransport } from './recording-transport';
import { readSentryRuntimeConfig, type SentryRuntimeConfig } from './config';
import {
  scrubSentryBreadcrumb,
  scrubSentryErrorEvent,
  scrubSentrySpan,
  scrubSentryTransaction,
} from './privacy';
import { resolveSentryTraceSampleRate } from './sampling';

const LOCAL_RECORDING_DSN = 'https://public@example.invalid/1';

type RuntimeOptions = BrowserOptions | NodeOptions;

function commonOptions(config: SentryRuntimeConfig): RuntimeOptions {
  const useRecordingTransport = config.localRecordingEnabled;
  const tracesSampleRate = resolveSentryTraceSampleRate({
    enabled: config.performanceEnabled,
    configuredRate: config.tracesSampleRate,
  });

  return {
    dsn: useRecordingTransport ? LOCAL_RECORDING_DSN : config.dsn,
    enabled: config.captureEnabled,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    sendClientReports: false,
    attachStacktrace: true,
    tracesSampleRate,
    beforeSend(event, hint) {
      return config.runtimeErrorsEnabled ? scrubSentryErrorEvent(event, hint) : null;
    },
    beforeBreadcrumb: scrubSentryBreadcrumb,
    beforeSendTransaction(event) {
      return config.performanceEnabled ? scrubSentryTransaction(event) : null;
    },
    beforeSendSpan: scrubSentrySpan,
    integrations(defaultIntegrations) {
      return defaultIntegrations.filter((integration) => {
        const integrationName = integration.name.toLowerCase();
        if (integrationName.includes('replay')) return false;
        if (
          !config.runtimeErrorsEnabled &&
          ['globalhandlers', 'trycatch', 'browserapierrors', 'captureconsole'].includes(
            integrationName,
          )
        ) {
          return false;
        }
        return true;
      });
    },
    ...(useRecordingTransport
      ? {
          transport: () =>
            createRecordingSentryTransport({
              reject: process.env.NEXT_PUBLIC_SENTRY_RECORDING_TRANSPORT_REJECT === '1',
            }),
        }
      : {}),
  };
}

export function buildClientSentryOptions(
  config: SentryRuntimeConfig = readSentryRuntimeConfig('client'),
): BrowserOptions {
  return commonOptions(config) as BrowserOptions;
}

export function buildServerSentryOptions(
  config: SentryRuntimeConfig = readSentryRuntimeConfig('node'),
): NodeOptions {
  return commonOptions(config) as NodeOptions;
}

export function buildEdgeSentryOptions(
  config: SentryRuntimeConfig = readSentryRuntimeConfig('edge'),
): NodeOptions {
  return commonOptions(config) as NodeOptions;
}
