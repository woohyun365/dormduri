import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectClientOperationalTelemetryAdapter } from '../client-config';

describe('client operational adapter selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('production gate가 닫히거나 endpoint가 없으면 no-op으로 유지한다', () => {
    const adapter = selectClientOperationalTelemetryAdapter({
      environment: 'production',
      release: 'release-1',
      runtimeErrorsEnabled: true,
      webVitalsEnabled: true,
      debug: false,
      productionGateOpen: false,
      coreWebVitalsSampleRate: 1,
      supportingWebVitalsSampleRate: 0.25,
    });
    expect(() => adapter.emit({} as never)).not.toThrow();
  });

  it('local과 preview에서는 endpoint가 있어도 외부 전송 adapter를 선택하지 않는다', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const environment of ['local', 'preview'] as const) {
      const adapter = selectClientOperationalTelemetryAdapter({
        environment,
        release: 'release-1',
        runtimeErrorsEnabled: true,
        webVitalsEnabled: true,
        debug: false,
        endpoint: 'https://telemetry.example.com/intake',
        productionGateOpen: true,
        coreWebVitalsSampleRate: 1,
        supportingWebVitalsSampleRate: 0.25,
      });

      adapter.emit({ eventName: 'web_runtime_error' } as never);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HTTPS endpoint adapter delivery failure는 reject를 외부로 전파하지 않는다', async () => {
    const fetchMock = vi.fn(async () => Promise.reject(new TypeError('provider unavailable')));
    vi.stubGlobal('fetch', fetchMock);
    const adapter = selectClientOperationalTelemetryAdapter({
      environment: 'production',
      release: 'release-1',
      runtimeErrorsEnabled: true,
      webVitalsEnabled: true,
      debug: false,
      endpoint: 'https://telemetry.example.com/intake',
      productionGateOpen: true,
      coreWebVitalsSampleRate: 1,
      supportingWebVitalsSampleRate: 0.25,
    });

    expect(() => adapter.emit({ eventName: 'web_runtime_error' } as never)).not.toThrow();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://telemetry.example.com/intake'),
      expect.objectContaining({ credentials: 'omit', keepalive: true, method: 'POST' }),
    );
  });
});
