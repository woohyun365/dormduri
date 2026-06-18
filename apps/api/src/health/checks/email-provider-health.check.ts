import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../config/app.config.js';
import emailConfig from '../../config/email.config.js';
import type { HealthReadinessCheck, HealthReadinessCheckResult } from './health-check.types.js';
import { createHealthCheckResult } from './health-check-result.js';

@Injectable()
export class EmailProviderHealthCheck implements HealthReadinessCheck {
  readonly name = 'emailProvider' as const;

  constructor(
    @Inject(appConfig.KEY)
    private readonly appSettings: ConfigType<typeof appConfig>,
    @Inject(emailConfig.KEY)
    private readonly emailSettings: ConfigType<typeof emailConfig>,
  ) {}

  check(): Promise<HealthReadinessCheckResult> {
    const startedAtMs = Date.now();
    const ready = this.isEmailProviderReady();

    return Promise.resolve(
      createHealthCheckResult({
        name: this.name,
        status: ready ? 'up' : 'down',
        code: ready ? 'EMAIL_PROVIDER_READY' : 'EMAIL_PROVIDER_INVALID',
        startedAtMs,
      }),
    );
  }

  private isEmailProviderReady(): boolean {
    if (!this.appSettings.isProduction && this.emailSettings.provider === 'stub') {
      return true;
    }

    if (this.emailSettings.provider !== 'ses') {
      return false;
    }

    return Boolean(this.emailSettings.ses.region && this.emailSettings.ses.fromEmail);
  }
}
