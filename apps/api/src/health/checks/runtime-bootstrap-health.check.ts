import { Injectable } from '@nestjs/common';
import {
  RUNTIME_BOOTSTRAP_RECEIPT_VERSION,
  readRuntimeBootstrapReceipt,
} from '../../platform/runtime/bootstrap/runtime-bootstrap-receipt.js';
import { SUPPORTED_SECRET_SOURCES } from '../../platform/runtime/secret-source.config.js';
import { createHealthCheckResult } from './health-check-result.js';
import type { HealthReadinessCheck, HealthReadinessCheckResult } from './health-check.types.js';

@Injectable()
export class RuntimeBootstrapHealthCheck implements HealthReadinessCheck {
  readonly name = 'runtimeBootstrap' as const;

  check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();
    const receipt = readRuntimeBootstrapReceipt();
    const valid =
      receipt?.version === RUNTIME_BOOTSTRAP_RECEIPT_VERSION &&
      receipt.status === 'prepared' &&
      SUPPORTED_SECRET_SOURCES.includes(receipt.secretSource) &&
      Number.isInteger(receipt.materializedSecretCount) &&
      receipt.materializedSecretCount >= 0 &&
      Number.isFinite(Date.parse(receipt.completedAt));

    return Promise.resolve(
      createHealthCheckResult({
        name: this.name,
        status: valid ? 'up' : 'down',
        code: valid ? 'RUNTIME_BOOTSTRAP_PREPARED' : 'RUNTIME_BOOTSTRAP_UNAVAILABLE',
        startedAtMs,
      }),
    );
  }
}
