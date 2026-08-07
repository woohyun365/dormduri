import type { OperationalTelemetryAdapter } from './types';

export function createHttpOperationalTelemetryAdapter(input: {
  endpoint: string;
}): OperationalTelemetryAdapter {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== 'https:') {
    throw new Error('Production operational telemetry endpoint must use HTTPS.');
  }

  return {
    emit: (event) => {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        credentials: 'omit',
        keepalive: true,
      }).catch(() => undefined);
    },
  };
}
