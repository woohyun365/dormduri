import {
  normalizeWebRuntimeMode,
  parseWebSentryEnv,
  type WebRuntimeMode,
  type WebSentryEnv,
} from '@/config/env.schema';
import { resolveOperationalEnvironment } from '../operational/operational-context';

export type SentryRuntimeKind = 'client' | 'node' | 'edge';

export type SentryRuntimeConfig = Readonly<
  WebSentryEnv & {
    environment: 'local' | 'preview' | 'production';
    release: string;
    runtimeMode: WebRuntimeMode;
    runtime: SentryRuntimeKind;
    captureEnabled: boolean;
  }
>;

function publicSentryEnv(): Partial<Record<string, string | undefined>> {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_ENABLED: process.env.NEXT_PUBLIC_SENTRY_ENABLED,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED:
      process.env.NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED,
    NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED: process.env.NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED: process.env.NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED,
    NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED:
      process.env.NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED,
    NEXT_PUBLIC_SENTRY_LOCAL_RECORDING: process.env.NEXT_PUBLIC_SENTRY_LOCAL_RECORDING,
    NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT:
      process.env.NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT,
    NEXT_PUBLIC_WEB_RELEASE: process.env.NEXT_PUBLIC_WEB_RELEASE,
  };
}

export function readSentryRuntimeConfig(
  runtime: SentryRuntimeKind,
  rawEnv: Partial<Record<string, string | undefined>> = publicSentryEnv(),
): SentryRuntimeConfig {
  const runtimeMode = normalizeWebRuntimeMode(rawEnv.NODE_ENV);
  const sentry = parseWebSentryEnv(rawEnv, runtimeMode);
  const environment = resolveOperationalEnvironment(
    rawEnv.NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT ?? rawEnv.NODE_ENV,
  );
  const productionGateOpen =
    environment !== 'production' ||
    (sentry.privacyApproved && sentry.releaseEvidenceApproved && sentry.dsn !== undefined);
  const activeSignal = sentry.runtimeErrorsEnabled || sentry.performanceEnabled;

  return {
    ...sentry,
    environment,
    release: rawEnv.NEXT_PUBLIC_WEB_RELEASE?.trim() || 'development',
    runtimeMode,
    runtime,
    captureEnabled:
      sentry.enabled &&
      activeSignal &&
      productionGateOpen &&
      (Boolean(sentry.dsn) || sentry.localRecordingEnabled),
  };
}
