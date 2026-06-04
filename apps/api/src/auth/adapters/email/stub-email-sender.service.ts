import { Injectable, Logger } from '@nestjs/common';
import type {
  EmailSender,
  PasswordResetMailInput,
  VerificationCodeMailInput,
} from './email-sender.interface.js';

@Injectable()
export class StubEmailSenderService implements EmailSender {
  private readonly logger = new Logger(StubEmailSenderService.name);

  sendVerificationCode(input: VerificationCodeMailInput): Promise<void> {
    this.logger.log(
      `[stub] signup verification email=${input.email} code=${input.code} ttl=${input.expiresInSeconds}s`,
    );
    return Promise.resolve();
  }

  sendPasswordResetCode(input: PasswordResetMailInput): Promise<void> {
    this.logger.log(
      `[stub] reset verification email=${input.email} code=${input.code} ttl=${input.expiresInSeconds}s`,
    );
    return Promise.resolve();
  }
}
