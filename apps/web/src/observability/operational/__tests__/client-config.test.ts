import { describe, expect, it } from 'vitest';
import { selectClientOperationalTelemetryAdapter } from '../client-config';

describe('client operational adapter selection', () => {
  it('production에서는 provider-neutral browser adapter를 항상 no-op으로 유지한다', () => {
    const adapter = selectClientOperationalTelemetryAdapter({
      environment: 'production',
      release: 'release-1',
      runtimeErrorsEnabled: false,
      webVitalsEnabled: false,
      debug: false,
      coreWebVitalsSampleRate: 1,
      supportingWebVitalsSampleRate: 1,
    });

    expect(() => adapter.emit({} as never)).not.toThrow();
  });

  it('local debug만 명시적인 console adapter를 선택한다', () => {
    const adapter = selectClientOperationalTelemetryAdapter({
      environment: 'local',
      release: 'release-1',
      runtimeErrorsEnabled: true,
      webVitalsEnabled: true,
      debug: true,
      coreWebVitalsSampleRate: 1,
      supportingWebVitalsSampleRate: 1,
    });

    expect(() => adapter.emit({ eventName: 'web_runtime_error' } as never)).not.toThrow();
  });
});
