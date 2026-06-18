import type { ConfigType } from '@nestjs/config';
import emailConfig from '../../../config/email.config.js';
import type { EmailSender } from './email-sender.interface.js';

export class EmailSenderProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSenderProviderConfigError';
  }
}

export function selectEmailSenderDelegate(
  settings: Pick<ConfigType<typeof emailConfig>, 'provider'>,
  delegates: { stub: EmailSender; ses: EmailSender },
  nodeEnv = process.env.NODE_ENV,
): EmailSender {
  switch (settings.provider) {
    case 'stub':
      if (nodeEnv === 'production') {
        throw new EmailSenderProviderConfigError('Stub email sender is not allowed in production.');
      }
      return delegates.stub;
    case 'ses':
      return delegates.ses;
    default:
      throw new EmailSenderProviderConfigError('Unsupported email provider.');
  }
}
