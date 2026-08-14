import type { OperationalTelemetryAdapter } from './types';

export const noopOperationalTelemetryAdapter: OperationalTelemetryAdapter = {
  emit: () => undefined,
};
