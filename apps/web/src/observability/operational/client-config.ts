import { debugOperationalTelemetryAdapter } from './adapters/debug';
import { noopOperationalTelemetryAdapter } from './adapters/noop';
import type { OperationalTelemetryAdapter } from './adapters/types';
import { resolveOperationalEnvironment } from './operational-context';

export type ClientOperationalTelemetryConfig = Readonly<{
  environment: 'local' | 'preview' | 'production';
  release: string;
  runtimeErrorsEnabled: boolean;
  webVitalsEnabled: boolean;
  debug: boolean;
  coreWebVitalsSampleRate: number;
  supportingWebVitalsSampleRate: number;
}>;

export function readClientOperationalTelemetryConfig(): ClientOperationalTelemetryConfig {
  const environment = resolveOperationalEnvironment(
    process.env.NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT ?? process.env.NODE_ENV,
  );
  const debug = process.env.NEXT_PUBLIC_WEB_OPERATIONAL_DEBUG === '1';
  const localOrTest = environment !== 'production';

  return {
    environment,
    release: process.env.NEXT_PUBLIC_WEB_RELEASE?.trim() || 'development',
    runtimeErrorsEnabled: localOrTest && (debug || process.env.NODE_ENV === 'test'),
    webVitalsEnabled: localOrTest && (debug || process.env.NODE_ENV === 'test'),
    debug,
    coreWebVitalsSampleRate: 1,
    supportingWebVitalsSampleRate: 1,
  };
}

export function selectClientOperationalTelemetryAdapter(
  config: ClientOperationalTelemetryConfig,
): OperationalTelemetryAdapter {
  if (config.debug && config.environment !== 'production') {
    return debugOperationalTelemetryAdapter;
  }
  return noopOperationalTelemetryAdapter;
}
