import { debugOperationalTelemetryAdapter } from './adapters/debug';
import { noopOperationalTelemetryAdapter } from './adapters/noop';
import { createHttpOperationalTelemetryAdapter } from './adapters/production';
import type { OperationalTelemetryAdapter } from './adapters/types';
import { resolveOperationalEnvironment } from './operational-context';

export type ClientOperationalTelemetryConfig = Readonly<{
  environment: 'local' | 'preview' | 'production';
  release: string;
  runtimeErrorsEnabled: boolean;
  webVitalsEnabled: boolean;
  debug: boolean;
  endpoint?: string;
  productionGateOpen: boolean;
  coreWebVitalsSampleRate: number;
  supportingWebVitalsSampleRate: number;
}>;

function readSampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function readClientOperationalTelemetryConfig(): ClientOperationalTelemetryConfig {
  const environment = resolveOperationalEnvironment(
    process.env.NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT ?? process.env.NODE_ENV,
  );
  const enabled = process.env.NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED === '1';
  const privacyApproved = process.env.NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED === '1';
  const retentionApproved = process.env.NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS !== undefined;
  const endpoint = process.env.NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT?.trim() || undefined;

  return {
    environment,
    release: process.env.NEXT_PUBLIC_WEB_RELEASE?.trim() || 'development',
    runtimeErrorsEnabled: enabled && process.env.NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED !== '0',
    webVitalsEnabled: enabled && process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED !== '0',
    debug: process.env.NEXT_PUBLIC_WEB_OPERATIONAL_DEBUG === '1',
    endpoint,
    productionGateOpen:
      environment !== 'production' ||
      (enabled && privacyApproved && retentionApproved && endpoint !== undefined),
    coreWebVitalsSampleRate: readSampleRate(process.env.NEXT_PUBLIC_WEB_VITALS_CORE_SAMPLE_RATE, 1),
    supportingWebVitalsSampleRate: readSampleRate(
      process.env.NEXT_PUBLIC_WEB_VITALS_SUPPORTING_SAMPLE_RATE,
      0.25,
    ),
  };
}

export function selectClientOperationalTelemetryAdapter(
  config: ClientOperationalTelemetryConfig,
): OperationalTelemetryAdapter {
  if (config.debug && config.environment !== 'production') {
    return debugOperationalTelemetryAdapter;
  }
  if (config.environment !== 'production' || !config.productionGateOpen || !config.endpoint) {
    return noopOperationalTelemetryAdapter;
  }
  try {
    return createHttpOperationalTelemetryAdapter({ endpoint: config.endpoint });
  } catch {
    return noopOperationalTelemetryAdapter;
  }
}
