import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import authConfig from '../../config/auth.config.js';
import { AuthCredentialMetricsService } from './auth-credential-metrics.service.js';

const CHANGE_PASSWORD_THROTTLER = 'change-password-session';

@Injectable()
export class ChangePasswordAdmissionService {
  constructor(
    @InjectThrottlerStorage() private readonly storage: ThrottlerStorage,
    @Inject(authConfig.KEY) private readonly settings: ConfigType<typeof authConfig>,
    private readonly metrics: AuthCredentialMetricsService,
  ) {}

  async consume(userId: string, sessionId: string): Promise<number | null> {
    const windowMs = this.settings.authChangePasswordWindowSeconds * 1_000;
    const fingerprint = createHmac('sha256', this.settings.persistenceHmacSecret)
      .update(`${userId}\0${sessionId}`)
      .digest('hex');
    const result = await this.storage.increment(
      `auth:change-password:${fingerprint}`,
      windowMs,
      this.settings.authChangePasswordLimit,
      windowMs,
      CHANGE_PASSWORD_THROTTLER,
    );
    const outcome = result.isBlocked ? 'throttled' : 'allowed';
    this.metrics.recordSensitiveMutation('change_password', outcome);

    return result.isBlocked ? Math.max(1, result.timeToBlockExpire) : null;
  }
}
