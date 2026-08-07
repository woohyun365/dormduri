import type { OperationalEvent } from '../operational-events';
import type { OperationalTelemetryAdapter } from './types';

export type RecordingOperationalTelemetryAdapter = OperationalTelemetryAdapter &
  Readonly<{
    events: OperationalEvent[];
    clear(): void;
  }>;

export function createRecordingOperationalTelemetryAdapter(): RecordingOperationalTelemetryAdapter {
  const events: OperationalEvent[] = [];
  return {
    events,
    emit: (event) => {
      events.push(event);
    },
    clear: () => {
      events.splice(0, events.length);
    },
  };
}
