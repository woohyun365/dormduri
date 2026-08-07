import type { OperationalTelemetryAdapter } from './types';

export const debugOperationalTelemetryAdapter: OperationalTelemetryAdapter = {
  emit: (event) => {
    console.debug('[web-operational]', event);
  },
};
