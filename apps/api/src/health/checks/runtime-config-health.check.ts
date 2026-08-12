import { Injectable } from '@nestjs/common';
import { envValidationSchema } from '../../config/environment/env.validation.js';
import type { HealthReadinessCheck, HealthReadinessCheckResult } from './health-check.types.js';
import { createHealthCheckResult } from './health-check-result.js';

@Injectable()
export class RuntimeConfigHealthCheck implements HealthReadinessCheck {
  readonly name = 'runtimeConfig' as const;

  check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();
    const { error } = envValidationSchema.validate(process.env, {
      abortEarly: false,
      allowUnknown: true,
    });

    return Promise.resolve(
      createHealthCheckResult({
        name: this.name,
        status: error ? 'down' : 'up',
        code: error ? 'RUNTIME_CONFIG_INVALID' : 'RUNTIME_CONFIG_VALID',
        startedAtMs,
      }),
    );
  }
}
