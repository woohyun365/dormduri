import type { Provider } from '@nestjs/common';
import { RetentionObservabilityService } from '../retention-observability.js';
import { RETENTION_OBSERVABILITY_PORT } from './retention.tokens.js';

export const RETENTION_OBSERVABILITY_PROVIDERS: Provider[] = [
  RetentionObservabilityService,
  {
    provide: RETENTION_OBSERVABILITY_PORT,
    useExisting: RetentionObservabilityService,
  },
];

export const RETENTION_PROVIDERS: Provider[] = [...RETENTION_OBSERVABILITY_PROVIDERS];
