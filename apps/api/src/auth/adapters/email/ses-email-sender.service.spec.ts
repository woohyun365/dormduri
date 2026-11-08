import type { ConfigType } from '@nestjs/config';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { describe, expect, it, vi } from 'vitest';
import emailConfig from './email.config.js';
import { SesEmailSenderError } from './ses-email-error.js';
import {
  SesEmailSenderService,
  buildPasswordChangedEmailInput,
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
    fromName: 'Dormduri',
    replyToEmail: 'support@example.com',
    configurationSet: 'dormduri-production',
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
      FromEmailAddress: '"Dormduri" <no-reply@example.com>',
      Destination: { ToAddresses: ['student@kangwon.ac.kr'] },
      ReplyToAddresses: ['support@example.com'],
      ConfigurationSetName: 'dormduri-production',
      Content: {
        Simple: {
          Subject: { Charset: 'UTF-8', Data: '[돔두리] 이메일 인증 코드' },
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
      FromEmailAddress: '"Dormduri" <no-reply@example.com>',
    });
  });

  it('returns SES receipt and applies configuration set plus bounded outbox tags', async () => {
    const send = vi.fn<SesEmailClient['send']>().mockResolvedValue({
      MessageId: 'ses-message-id',
      $metadata: {},
    });
    const service = new SesEmailSenderService(settings, { send });

    await expect(
      service.sendPasswordResetCode({
        email: 'student@kangwon.ac.kr',
        code: '654321',
        expiresInSeconds: 600,
        correlationId: 'outbox-event-1',
      }),
    ).resolves.toEqual({ providerMessageId: 'ses-message-id' });

    const [command] = send.mock.calls[0] ?? [];
    expect(command?.input).toMatchObject({
      ConfigurationSetName: 'dormduri-production',
      EmailTags: [
        { Name: 'auth-mail-kind', Value: 'PASSWORD_RESET_VERIFICATION' },
        { Name: 'auth-outbox-id', Value: 'outbox-event-1' },
      ],
    });
  });

  it('password changed notice는 code 없이 별도 mail kind로 구성한다', () => {
    const commandInput = buildPasswordChangedEmailInput(
      {
        email: 'student@kangwon.ac.kr',
        correlationId: 'password-changed-1',
      },
      resolveSesEmailConfig(settings),
    );

    expect(commandInput.Content?.Simple?.Subject?.Data).toContain('비밀번호가 변경');
    expect(commandInput.EmailTags).toContainEqual({
      Name: 'auth-mail-kind',
      Value: 'PASSWORD_CHANGED',
    });
    expect(commandInput.Content?.Simple?.Body?.Text?.Data).not.toMatch(/인증 코드/u);
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

describe('SES From display name encoding', () => {
  const FROM_ADDRESS_SUFFIX = ' <no-reply@example.com>';
  const ENCODED_WORD = /^=\?UTF-8\?B\?([A-Za-z0-9+/]+={0,2})\?=$/u;

  function fromAddressFor(fromName: string): string {
    const commandInput = buildVerificationCodeEmailInput(
      { email: 'student@kangwon.ac.kr', code: '123456', expiresInSeconds: 600 },
      resolveSesEmailConfig({ ...settings, ses: { ...settings.ses, fromName } }),
    );
    return commandInput.FromEmailAddress ?? '';
  }

  function encodedWordsOf(fromAddress: string): string[] {
    expect(fromAddress.endsWith(FROM_ADDRESS_SUFFIX)).toBe(true);
    return fromAddress.slice(0, -FROM_ADDRESS_SUFFIX.length).split(' ');
  }

  // A fatal decoder fails when a word ends in the middle of a multi-byte character.
  function decodeEncodedWord(word: string): string {
    const payload = ENCODED_WORD.exec(word)?.[1];
    expect(payload, word).toBeDefined();
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(payload ?? '', 'base64'));
  }

  it('encodes a non-ASCII display name as an RFC 2047 encoded-word', () => {
    expect(fromAddressFor('돔두리')).toBe('=?UTF-8?B?64+U65GQ66as?= <no-reply@example.com>');
  });

  it('keeps a display name that fills one encoded-word in a single word of at most 75 chars', () => {
    const words = encodedWordsOf(fromAddressFor('가'.repeat(15)));

    expect(words).toHaveLength(1);
    expect(words[0]?.length).toBeLessThanOrEqual(75);
    expect(decodeEncodedWord(words[0] ?? '')).toBe('가'.repeat(15));
  });

  it('splits a longer display name into several words of at most 75 chars', () => {
    const name = '가'.repeat(16);
    const words = encodedWordsOf(fromAddressFor(name));

    expect(words).toHaveLength(2);
    for (const word of words) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(words.map(decodeEncodedWord).join('')).toBe(name);
  });

  // 46 bytes would take 64 base64 chars, one word of 76 chars.
  it('starts a second encoded-word at the 46th byte', () => {
    const name = `${'가'.repeat(15)}a`;
    const words = encodedWordsOf(fromAddressFor(name));

    expect(words).toHaveLength(2);
    for (const word of words) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(words.map(decodeEncodedWord).join('')).toBe(name);
  });

  it('does not split a four-byte character across encoded-words', () => {
    const name = '😀'.repeat(20);
    const words = encodedWordsOf(fromAddressFor(name));

    expect(words.length).toBeGreaterThan(1);
    for (const word of words) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
    expect(words.map(decodeEncodedWord).join('')).toBe(name);
  });

  it('encodes the whole name, including ASCII quotes, when any character is non-ASCII', () => {
    const name = '돔두리 "공지"';
    const fromAddress = fromAddressFor(name);

    expect(fromAddress).not.toContain('"');
    expect(encodedWordsOf(fromAddress).map(decodeEncodedWord).join('')).toBe(name);
  });

  it('does not carry a control character into the From address', () => {
    expect(fromAddressFor('Dormduri\r\nBcc: other@example.com')).not.toMatch(/[\r\n]/u);
  });

  it('keeps quoting a printable ASCII display name', () => {
    expect(fromAddressFor('Dormduri')).toBe('"Dormduri" <no-reply@example.com>');
    expect(fromAddressFor('Dorm"duri\\')).toBe('"Dorm\\"duri\\\\" <no-reply@example.com>');
  });
});
