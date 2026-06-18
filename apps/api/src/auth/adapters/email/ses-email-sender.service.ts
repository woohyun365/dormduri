import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import emailConfig from '../../../config/email.config.js';
import type {
  EmailSender,
  PasswordResetMailInput,
  VerificationCodeMailInput,
} from './email-sender.interface.js';
import { SesEmailSenderError, toSesEmailSenderError } from './ses-email-error.js';

const UTF8 = 'UTF-8';

export const SES_EMAIL_CLIENT = Symbol('SES_EMAIL_CLIENT');

export interface SesEmailClient {
  send(command: SendEmailCommand): Promise<SendEmailCommandOutput>;
}

interface ResolvedSesEmailConfig {
  region: string;
  fromEmail: string;
  fromName: string | null;
  replyToEmail: string | null;
  configurationSet: string | null;
}

@Injectable()
export class SesEmailSenderService implements EmailSender {
  private client: SesEmailClient | null = null;

  constructor(
    @Inject(emailConfig.KEY)
    private readonly settings: ConfigType<typeof emailConfig>,
    @Optional()
    @Inject(SES_EMAIL_CLIENT)
    private readonly clientOverride?: SesEmailClient,
  ) {}

  async sendVerificationCode(input: VerificationCodeMailInput): Promise<void> {
    await this.sendEmail(
      buildVerificationCodeEmailInput(input, resolveSesEmailConfig(this.settings)),
    );
  }

  async sendPasswordResetCode(input: PasswordResetMailInput): Promise<void> {
    await this.sendEmail(buildPasswordResetEmailInput(input, resolveSesEmailConfig(this.settings)));
  }

  private async sendEmail(commandInput: SendEmailCommandInput) {
    try {
      await this.getClient(resolveSesEmailConfig(this.settings)).send(
        new SendEmailCommand(commandInput),
      );
    } catch (error) {
      throw toSesEmailSenderError(error);
    }
  }

  private getClient(config: ResolvedSesEmailConfig): SesEmailClient {
    if (this.clientOverride) {
      return this.clientOverride;
    }

    this.client ??= new SESv2Client({ region: config.region });
    return this.client;
  }
}

export function resolveSesEmailConfig(
  settings: ConfigType<typeof emailConfig>,
): ResolvedSesEmailConfig {
  const region = settings.ses.region?.trim();
  const fromEmail = settings.ses.fromEmail?.trim();

  if (settings.provider !== 'ses' || !region || !fromEmail) {
    throw new SesEmailSenderError('CONFIG_INVALID', 'SES email provider config is invalid.');
  }

  return {
    region,
    fromEmail,
    fromName: settings.ses.fromName?.trim() || null,
    replyToEmail: settings.ses.replyToEmail?.trim() || null,
    configurationSet: settings.ses.configurationSet?.trim() || null,
  };
}

export function buildVerificationCodeEmailInput(
  input: VerificationCodeMailInput,
  config: ResolvedSesEmailConfig,
): SendEmailCommandInput {
  return buildSimpleEmailInput({
    toEmail: input.email,
    subject: '[KNU Roommate] 이메일 인증 코드',
    bodyText: [
      'KNU Roommate 이메일 인증 코드입니다.',
      '',
      `인증 코드: ${input.code}`,
      `만료 시간: ${formatExpiresIn(input.expiresInSeconds)}`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
    ].join('\n'),
    config,
  });
}

export function buildPasswordResetEmailInput(
  input: PasswordResetMailInput,
  config: ResolvedSesEmailConfig,
): SendEmailCommandInput {
  return buildSimpleEmailInput({
    toEmail: input.email,
    subject: '[KNU Roommate] 비밀번호 재설정 인증 코드',
    bodyText: [
      'KNU Roommate 비밀번호 재설정 인증 코드입니다.',
      '',
      `인증 코드: ${input.code}`,
      `만료 시간: ${formatExpiresIn(input.expiresInSeconds)}`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해 주세요.',
    ].join('\n'),
    config,
  });
}

function buildSimpleEmailInput(input: {
  toEmail: string;
  subject: string;
  bodyText: string;
  config: ResolvedSesEmailConfig;
}): SendEmailCommandInput {
  const commandInput: SendEmailCommandInput = {
    FromEmailAddress: formatFromAddress(input.config),
    Destination: {
      ToAddresses: [input.toEmail],
    },
    Content: {
      Simple: {
        Subject: {
          Charset: UTF8,
          Data: input.subject,
        },
        Body: {
          Text: {
            Charset: UTF8,
            Data: input.bodyText,
          },
        },
      },
    },
  };

  if (input.config.replyToEmail) {
    commandInput.ReplyToAddresses = [input.config.replyToEmail];
  }

  if (input.config.configurationSet) {
    commandInput.ConfigurationSetName = input.config.configurationSet;
  }

  return commandInput;
}

function formatFromAddress(config: ResolvedSesEmailConfig) {
  if (!config.fromName) {
    return config.fromEmail;
  }

  return `${quoteDisplayName(config.fromName)} <${config.fromEmail}>`;
}

function quoteDisplayName(displayName: string) {
  return `"${displayName.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function formatExpiresIn(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (seconds > 0 && seconds % 60 === 0 && minutes > 0) {
    return `${minutes}분`;
  }

  return `${seconds}초`;
}
