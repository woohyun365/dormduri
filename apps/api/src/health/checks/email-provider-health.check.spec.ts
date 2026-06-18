import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { EmailProviderHealthCheck } from './email-provider-health.check.js';

const sesSettings = {
  provider: 'ses' as const,
  ses: {
    region: 'ap-northeast-2',
    fromEmail: 'no-reply@example.com',
    fromName: null,
    replyToEmail: null,
    configurationSet: null,
  },
};

describe('EmailProviderHealthCheck', () => {
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T03:00:00.000Z'));
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('local stub provider는 readiness-ready로 둔다', async () => {
    const check = new EmailProviderHealthCheck(
      { isProduction: false, nodeEnv: 'test', port: 4000 },
      {
        provider: 'stub',
        ses: {
          region: null,
          fromEmail: null,
          fromName: null,
          replyToEmail: null,
          configurationSet: null,
        },
      },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'emailProvider',
      status: 'up',
      code: 'EMAIL_PROVIDER_READY',
    });
  });

  it('production SES provider config가 준비되면 up이다', async () => {
    const check = new EmailProviderHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      sesSettings,
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'emailProvider',
      status: 'up',
      code: 'EMAIL_PROVIDER_READY',
    });
  });

  it('production stub provider는 readiness failure다', async () => {
    const check = new EmailProviderHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      {
        provider: 'stub',
        ses: {
          region: null,
          fromEmail: null,
          fromName: null,
          replyToEmail: null,
          configurationSet: null,
        },
      },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'emailProvider',
      status: 'down',
      code: 'EMAIL_PROVIDER_INVALID',
    });
  });

  it('SES region/fromEmail 누락은 readiness failure다', async () => {
    const check = new EmailProviderHealthCheck(
      { isProduction: true, nodeEnv: 'production', port: 4000 },
      {
        provider: 'ses',
        ses: { ...sesSettings.ses, region: null },
      },
    );

    await expect(check.check()).resolves.toMatchObject({
      name: 'emailProvider',
      status: 'down',
      code: 'EMAIL_PROVIDER_INVALID',
    });
  });
});
