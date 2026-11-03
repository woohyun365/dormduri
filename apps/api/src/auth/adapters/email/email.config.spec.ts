import { describe, expect, it } from 'vitest';
import emailConfig, { readEmailProvider } from './email.config.js';

describe('emailConfig', () => {
  it('defaults to stub for local/test execution', () => {
    expect(readEmailProvider({ NODE_ENV: 'test' })).toBe('stub');
  });

  it('parses supported provider values', () => {
    expect(readEmailProvider({ EMAIL_PROVIDER: 'ses' })).toBe('ses');
    expect(() => readEmailProvider({ EMAIL_PROVIDER: 'smtp' })).toThrow(/EMAIL_PROVIDER/);
  });

  it('exposes SES metadata without forcing real AWS calls', () => {
    const previousEnv = { ...process.env };
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.SES_REGION = 'ap-northeast-2';
    process.env.SES_FROM_EMAIL = 'no-reply@example.com';
    process.env.SES_FROM_NAME = 'KNU Roommate';
    process.env.SES_REPLY_TO_EMAIL = 'support@example.com';
    process.env.SES_CONFIGURATION_SET = 'dormduri-production';

    try {
      expect(emailConfig()).toMatchObject({
        provider: 'ses',
        ses: {
          region: 'ap-northeast-2',
          fromEmail: 'no-reply@example.com',
          fromName: 'KNU Roommate',
          replyToEmail: 'support@example.com',
          configurationSet: 'dormduri-production',
        },
      });
    } finally {
      process.env = previousEnv;
    }
  });
});
