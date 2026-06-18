import type { ConfigType } from '@nestjs/config';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { describe, expect, it, vi } from 'vitest';
import emailConfig from '../../../config/email.config.js';
import { SesEmailSenderError } from './ses-email-error.js';
import {
  SesEmailSenderService,
  buildPasswordResetEmailInput,
  buildVerificationCodeEmailInput,
  resolveSesEmailConfig,
  type SesEmailClient,
} from './ses-email-sender.service.js';

const settings = {
  provider: 'ses',
  ses: {
    region: 'ap-northeast-2',
    fromEmail: 'no-reply@example.com',
    fromName: 'KNU Roommate',
    replyToEmail: 'support@example.com',
    configurationSet: 'knu-roommate-production',
  },
} satisfies ConfigType<typeof emailConfig>;

describe('SesEmailSenderService', () => {
  it('maps signup verification mail to SES simple email payload', () => {
    const commandInput = buildVerificationCodeEmailInput(
      {
        email: 'student@kangwon.ac.kr',
        code: '123456',
        expiresInSeconds: 600,
      },
      resolveSesEmailConfig(settings),
    );

    expect(commandInput).toMatchObject({
      FromEmailAddress: '"KNU Roommate" <no-reply@example.com>',
      Destination: { ToAddresses: ['student@kangwon.ac.kr'] },
      ReplyToAddresses: ['support@example.com'],
      ConfigurationSetName: 'knu-roommate-production',
      Content: {
        Simple: {
          Subject: { Charset: 'UTF-8', Data: '[KNU Roommate] 이메일 인증 코드' },
        },
      },
    });
    expect(commandInput.Content?.Simple?.Body?.Text?.Charset).toBe('UTF-8');
    expect(commandInput.Content?.Simple?.Body?.Text?.Data).toContain('123456');
  });

  it('maps password reset mail without optional reply/config set when unset', () => {
    const commandInput = buildPasswordResetEmailInput(
      {
        email: 'student@kangwon.ac.kr',
        code: '654321',
        expiresInSeconds: 900,
      },
      resolveSesEmailConfig({
        provider: 'ses',
        ses: {
          region: 'ap-northeast-2',
          fromEmail: 'no-reply@example.com',
          fromName: null,
          replyToEmail: null,
          configurationSet: null,
        },
      }),
    );

    expect(commandInput.FromEmailAddress).toBe('no-reply@example.com');
    expect(commandInput.ReplyToAddresses).toBeUndefined();
    expect(commandInput.ConfigurationSetName).toBeUndefined();
    expect(commandInput.Content?.Simple?.Subject?.Data).toContain('비밀번호 재설정');
  });

  it('sends SES command through injected fake client without real AWS network', async () => {
    const send = vi.fn<SesEmailClient['send']>().mockResolvedValue({
      MessageId: 'ses-message-id',
      $metadata: {},
    });
    const service = new SesEmailSenderService(settings, { send });

    await service.sendVerificationCode({
      email: 'student@kangwon.ac.kr',
      code: '123456',
      expiresInSeconds: 600,
    });

    expect(send).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    const [command] = send.mock.calls[0] ?? [];
    expect(command?.input).toMatchObject({
      Destination: { ToAddresses: ['student@kangwon.ac.kr'] },
      FromEmailAddress: '"KNU Roommate" <no-reply@example.com>',
    });
  });

  it('throws CONFIG_INVALID when SES config is incomplete', async () => {
    const service = new SesEmailSenderService(
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
      { send: vi.fn() },
    );

    await expect(
      service.sendVerificationCode({
        email: 'student@kangwon.ac.kr',
        code: '123456',
        expiresInSeconds: 600,
      }),
    ).rejects.toMatchObject({ providerErrorCategory: 'CONFIG_INVALID' });
  });

  it('wraps provider failure with bounded category and no raw provider message', async () => {
    const rawError = Object.assign(new Error('raw AWS quota detail'), {
      name: 'TooManyRequestsException',
    });
    const service = new SesEmailSenderService(settings, {
      send: vi.fn<SesEmailClient['send']>().mockRejectedValue(rawError),
    });

    await expect(
      service.sendPasswordResetCode({
        email: 'student@kangwon.ac.kr',
        code: '654321',
        expiresInSeconds: 900,
      }),
    ).rejects.toMatchObject({ providerErrorCategory: 'THROTTLED' });

    await service
      .sendPasswordResetCode({
        email: 'student@kangwon.ac.kr',
        code: '654321',
        expiresInSeconds: 900,
      })
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(SesEmailSenderError);
        expect(error instanceof Error ? error.message : String(error)).not.toContain('raw AWS');
      });
  });
});
