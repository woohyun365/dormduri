import { describe, expect, it } from 'vitest';
import { createOperationalEventEnvelope } from '../operational-context';
import { OperationalTelemetry } from '../operational-telemetry';
import { createRecordingOperationalTelemetryAdapter } from '../adapters/recording';

function metricEvent(metricId: string) {
  return {
    ...createOperationalEventEnvelope({ occurredAt: '2026-08-06T00:00:00.000Z' }),
    eventName: 'web_vital_measured' as const,
    metric: 'LCP' as const,
    value: 1200,
    metricId,
    attributionKeys: [],
  };
}

describe('OperationalTelemetry', () => {
  it('bounded queue overflow 시 오래된 event를 drop한다', async () => {
    const recording = createRecordingOperationalTelemetryAdapter();
    const telemetry = new OperationalTelemetry(recording, 2);
    telemetry.emit(metricEvent('one'));
    telemetry.emit(metricEvent('two'));
    telemetry.emit(metricEvent('three'));
    await telemetry.flush();

    expect(
      recording.events.map((event) => event.eventName === 'web_vital_measured' && event.metricId),
    ).toEqual(['two', 'three']);
  });

  it('adapter가 throw해도 caller와 다음 event를 막지 않는다', async () => {
    const emitted: string[] = [];
    const telemetry = new OperationalTelemetry({
      emit: (event) => {
        if (event.eventName === 'web_vital_measured' && event.metricId === 'one') {
          throw new Error('sink unavailable');
        }
        emitted.push(event.eventName === 'web_vital_measured' ? event.metricId : event.eventName);
      },
    });

    expect(() => telemetry.emit(metricEvent('one'))).not.toThrow();
    telemetry.emit(metricEvent('two'));
    await expect(telemetry.flush()).resolves.toBeUndefined();
    expect(emitted).toEqual(['two']);
  });
});
