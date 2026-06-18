import { registerAs } from '@nestjs/config';
import { readStringEnv } from './env.helpers.js';

export const EMAIL_PROVIDER_ENV = 'EMAIL_PROVIDER';
export const SES_REGION_ENV = 'SES_REGION';
export const SES_FROM_EMAIL_ENV = 'SES_FROM_EMAIL';
export const SES_FROM_NAME_ENV = 'SES_FROM_NAME';
export const SES_REPLY_TO_EMAIL_ENV = 'SES_REPLY_TO_EMAIL';
export const SES_CONFIGURATION_SET_ENV = 'SES_CONFIGURATION_SET';

export const DEFAULT_EMAIL_PROVIDER = 'stub' as const;

export type EmailProvider = 'stub' | 'ses';

export function readEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const provider = readStringEnv(env, EMAIL_PROVIDER_ENV, DEFAULT_EMAIL_PROVIDER).toLowerCase();
  if (provider === 'stub' || provider === 'ses') {
    return provider;
  }

  throw new Error(`[config] ${EMAIL_PROVIDER_ENV} must be one of stub, ses.`);
}

export default registerAs('email', () => {
  const provider = readEmailProvider(process.env);

  return {
    provider,
    ses: {
      region: process.env[SES_REGION_ENV]?.trim() || null,
      fromEmail: process.env[SES_FROM_EMAIL_ENV]?.trim() || null,
      fromName: process.env[SES_FROM_NAME_ENV]?.trim() || null,
      replyToEmail: process.env[SES_REPLY_TO_EMAIL_ENV]?.trim() || null,
      configurationSet: process.env[SES_CONFIGURATION_SET_ENV]?.trim() || null,
    },
  };
});
