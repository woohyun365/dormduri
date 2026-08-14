import { Injectable, Logger } from '@nestjs/common';
import type {
  EmailSendReceipt,
  EmailSender,
  PasswordChangedMailInput,
  PasswordResetMailInput,
  VerificationCodeMailInput,
} from './email-sender.interface.js';

@Injectable()
export class StubEmailSenderService implements EmailSender {
  private readonly logger = new Logger(StubEmailSenderService.name);

  sendVerificationCode(input: VerificationCodeMailInput): Promise<EmailSendReceipt> {
    this.logger.log(
      `[stub] signup verification email=${input.email} code=${input.code} ttl=${input.expiresInSeconds}s`,
    );
    return Promise.resolve({ providerMessageId: null });
  }

  sendPasswordResetCode(input: PasswordResetMailInput): Promise<EmailSendReceipt> {
    this.logger.log(
      `[stub] reset verification email=${input.email} code=${input.code} ttl=${input.expiresInSeconds}s`,
    );
    return Promise.resolve({ providerMessageId: null });
  }

  sendPasswordChanged(input: PasswordChangedMailInput): Promise<EmailSendReceipt> {
    this.logger.log(`[stub] password changed email=${input.email}`);
    return Promise.resolve({ providerMessageId: null });
  }
}
