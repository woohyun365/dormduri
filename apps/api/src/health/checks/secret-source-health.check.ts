import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../config/app.config.js';
import secretSourceConfig from '../../config/secret-source.config.js';
import { secretEnvKeys } from '../../config/env-keys/index.js';
import type { HealthReadinessCheck, HealthReadinessCheckResult } from './health-check.types.js';
import { createHealthCheckResult } from './health-check-result.js';

@Injectable()
export class SecretSourceHealthCheck implements HealthReadinessCheck {
  readonly name = 'secretSource' as const;

  constructor(
    @Inject(appConfig.KEY)
    private readonly appSettings: ConfigType<typeof appConfig>,
    @Inject(secretSourceConfig.KEY)
    private readonly secretSourceSettings: ConfigType<typeof secretSourceConfig>,
  ) {}

  check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();
    const valid = this.isSecretSourceReady();

    return Promise.resolve(
      createHealthCheckResult({
        name: this.name,
        status: valid ? 'up' : 'down',
        code: valid ? 'SECRET_SOURCE_VALID' : 'SECRET_SOURCE_INVALID',
        startedAtMs,
      }),
    );
  }

  private isSecretSourceReady(): boolean {
    if (!this.appSettings.isProduction) {
      return true;
    }

    if (
      this.secretSourceSettings.source === 'aws-secrets-manager' &&
      !this.secretSourceSettings.secretNamePrefix
    ) {
      return false;
    }

    return secretEnvKeys.every((definition) => {
      const value = process.env[definition.key];
      return typeof value === 'string' && value.trim().length > 0;
    });
  }
}
