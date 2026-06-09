import type { Provider } from '@nestjs/common';
import { RetentionSweepService } from '../application/retention-sweep.service.js';
import { RETENTION_SWEEP_PORT } from '../application/ports/retention-sweep.port.js';
import { RetentionObservabilityService } from '../retention-observability.js';
import { RETENTION_OBSERVABILITY_PORT } from './retention.tokens.js';

export const RETENTION_SWEEP_PROVIDERS: Provider[] = [
  RetentionSweepService,
  {
    provide: RETENTION_SWEEP_PORT,
    useExisting: RetentionSweepService,
  },
];

export const RETENTION_OBSERVABILITY_PROVIDERS: Provider[] = [
  RetentionObservabilityService,
  {
    provide: RETENTION_OBSERVABILITY_PORT,
    useExisting: RetentionObservabilityService,
  },
];

export const RETENTION_PROVIDERS: Provider[] = [
  ...RETENTION_SWEEP_PROVIDERS,
  ...RETENTION_OBSERVABILITY_PROVIDERS,
];
