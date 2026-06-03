import { Injectable } from '@nestjs/common';
import type {
  EmailSender,
  PasswordResetMailInput,
  VerificationCodeMailInput,
} from './email-sender.interface.js';
import { StubEmailSenderService } from './stub-email-sender.service.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../../auth-security-event.service.js';
import { AUTH_SECURITY_EVENT_METRICS } from '../../auth-security-event.types.js';

function providerErrorCategory(error: unknown) {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return typeof error;
}

@Injectable()
export class MonitoredEmailSenderService implements EmailSender {
  constructor(
    private readonly delegate: StubEmailSenderService,
    private readonly securityEvents: AuthSecurityEventService,
  ) {}

  async sendVerificationCode(input: VerificationCodeMailInput): Promise<void> {
    await this.sendWithMonitoring('SIGNUP', input, () => this.delegate.sendVerificationCode(input));
  }

  async sendPasswordResetCode(input: PasswordResetMailInput): Promise<void> {
    await this.sendWithMonitoring('RESET_PASSWORD', input, () =>
      this.delegate.sendPasswordResetCode(input),
    );
  }

  private async sendWithMonitoring(
    purpose: 'SIGNUP' | 'RESET_PASSWORD',
    input: VerificationCodeMailInput | PasswordResetMailInput,
    send: () => Promise<void>,
  ) {
    try {
      await send();
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'MAIL_SEND_SUCCESS',
        severity: 'INFO',
        emailNormalized: input.email,
        metadata: {
          purpose,
          metricName: AUTH_SECURITY_EVENT_METRICS.mailSendSuccess,
          ttlSeconds: input.expiresInSeconds,
        },
      });
    } catch (error) {
      await recordAuthSecurityEventSafely(this.securityEvents, {
        type: 'MAIL_SEND_FAILURE',
        severity: 'WARNING',
        emailNormalized: input.email,
        metadata: {
          purpose,
          metricName: AUTH_SECURITY_EVENT_METRICS.mailSendFailure,
          providerErrorCategory: providerErrorCategory(error),
          ttlSeconds: input.expiresInSeconds,
        },
      });
      throw error;
    }
  }
}
