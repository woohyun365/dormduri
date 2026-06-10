import { Injectable, Logger } from '@nestjs/common';
import { buildRetentionSweepFailureAlert } from './retention-alerts.js';
import { buildRetentionSweepEmission } from './retention-metrics.js';
import type {
  RetentionMetric,
  RetentionObservabilitySweepInput,
  RetentionOperationalAlert,
} from './retention-observability.types.js';

@Injectable()
export class RetentionObservabilityService {
  private readonly logger = new Logger(RetentionObservabilityService.name);

  async emitSweep(input: RetentionObservabilitySweepInput) {
    const emission = await buildRetentionSweepEmission(input);

    for (const metric of emission.metrics) {
      this.logger.log(toMetricLogPayload(metric));
    }

    for (const alert of emission.alerts) {
      const payload = toAlertLogPayload(alert);
      if (alert.severity === 'critical') {
        this.logger.error(payload);
      } else {
        this.logger.warn(payload);
      }
    }

    return emission;
  }

  emitSweepFailure(input: { mode: 'periodic' | 'boundary'; error: unknown; occurredAt?: Date }) {
    const alert = buildRetentionSweepFailureAlert(input);
    this.logger.error(toAlertLogPayload(alert));
    return alert;
  }
}

function toMetricLogPayload(metric: RetentionMetric) {
  return { event: 'retention.metric', ...metric };
}

function toAlertLogPayload(alert: RetentionOperationalAlert) {
  return { event: 'retention.alert', ...alert };
}
