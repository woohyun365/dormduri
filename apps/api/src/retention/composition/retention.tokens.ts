import type {
  RetentionObservabilitySweepEmission,
  RetentionObservabilitySweepInput,
  RetentionOperationalAlert,
} from '../observability/retention-observability.types.js';

export const RETENTION_OBSERVABILITY_PORT = Symbol('RETENTION_OBSERVABILITY_PORT');

export interface RetentionObservabilityPort {
  emitSweep(input: RetentionObservabilitySweepInput): Promise<RetentionObservabilitySweepEmission>;
  emitSweepFailure(input: {
    mode: 'periodic' | 'boundary';
    error: unknown;
    occurredAt?: Date;
  }): RetentionOperationalAlert;
}
