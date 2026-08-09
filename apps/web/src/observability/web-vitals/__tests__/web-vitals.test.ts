import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordingOperationalTelemetryAdapter } from '../../operational/adapters/recording';
import {
  operationalTelemetry,
  setOperationalTelemetryAdapter,
} from '../../operational/operational-telemetry';
import { reportWebVital, sanitizeWebVitalMetric } from '../web-vitals';

describe('Web Vitals operational reporter', () => {
  const recording = createRecordingOperationalTelemetryAdapter();
  let restoreAdapter: () => void = () => undefined;

  beforeEach(() => {
    recording.clear();
    restoreAdapter = setOperationalTelemetryAdapter(recording);
  });

  afterEach(() => {
    restoreAdapter();
  });

  it.each(['LCP', 'INP', 'CLS'] as const)('records %s without attribution values', async (name) => {
    reportWebVital({
      id: `${name.toLowerCase()}-metric`,
      name,
      value: name === 'CLS' ? 0.02 : 180,
      delta: name === 'CLS' ? 0.01 : 20,
      rating: 'good',
      navigationType: 'navigate',
      attribution: {
        element: '<section>사용자 입력 본문</section>',
        url: 'https://example.test/private?token=secret',
      },
    });
    await operationalTelemetry.flush();

    expect(recording.events.at(-1)).toMatchObject({
      eventName: 'web_vital_measured',
      metric: name,
      attributionKeys: ['element', 'url'],
    });
    expect(JSON.stringify(recording.events)).not.toContain('사용자 입력 본문');
    expect(JSON.stringify(recording.events)).not.toContain('token=secret');
  });

  it('keeps FID sanitizer compatibility but does not report it', async () => {
    expect(sanitizeWebVitalMetric({ id: 'fid', name: 'FID', value: 10 })).toMatchObject({
      name: 'FID',
    });
    reportWebVital({ id: 'fid', name: 'FID', value: 10 });
    await operationalTelemetry.flush();
    expect(recording.events).toHaveLength(0);
  });

  it('drops unsupported metric names and non-finite values', () => {
    expect(sanitizeWebVitalMetric({ id: 'metric-1', name: 'CUSTOM', value: 1 })).toBeNull();
    expect(sanitizeWebVitalMetric({ id: 'metric-2', name: 'CLS', value: Number.NaN })).toBeNull();
  });
});
