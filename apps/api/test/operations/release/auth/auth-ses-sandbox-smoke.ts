import { pathToFileURL } from 'node:url';
import type { EmailSender } from '../../../../src/auth/adapters/email/email-sender.interface.js';
import { SesEmailSenderError } from '../../../../src/auth/adapters/email/ses-email-error.js';
import { SesEmailSenderService } from '../../../../src/auth/adapters/email/ses-email-sender.service.js';

export type AuthSesSmokeResult =
  | { status: 'dry-run'; configurationSetEnabled: true }
  | { status: 'accepted'; configurationSetEnabled: true; providerMessageIdPresent: boolean }
  | { status: 'failed'; category: string };

type AuthSesSmokeSettings = {
  region: string;
  fromEmail: string;
  fromName: string | null;
  replyToEmail: string | null;
  configurationSet: string;
  recipient: string;
};

export function resolveAuthSesSmokeSettings(env: NodeJS.ProcessEnv): AuthSesSmokeSettings {
  if (env.EMAIL_PROVIDER?.trim().toLowerCase() !== 'ses') {
    throw new Error('EMAIL_PROVIDER=ses is required');
  }

  const settings: AuthSesSmokeSettings = {
    region: env.SES_REGION?.trim() ?? '',
    fromEmail: env.SES_FROM_EMAIL?.trim() ?? '',
    fromName: env.SES_FROM_NAME?.trim() || null,
    replyToEmail: env.SES_REPLY_TO_EMAIL?.trim() || null,
    configurationSet: env.SES_CONFIGURATION_SET?.trim() ?? '',
    recipient: env.AUTH_SES_SMOKE_RECIPIENT?.trim() ?? '',
  };
  const missing = Object.entries(settings)
    .filter(
      ([key, value]) =>
        ['region', 'fromEmail', 'configurationSet', 'recipient'].includes(key) && !value,
    )
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`missing required SES smoke settings: ${missing.join(', ')}`);
  }

  return settings;
}

export async function runAuthSesSandboxSmoke(input: {
  settings: AuthSesSmokeSettings;
  dryRun: boolean;
  sender?: EmailSender;
}): Promise<AuthSesSmokeResult> {
  if (input.dryRun) {
    return { status: 'dry-run', configurationSetEnabled: true };
  }

  const sender =
    input.sender ??
    new SesEmailSenderService({
      provider: 'ses',
      ses: {
        region: input.settings.region,
        fromEmail: input.settings.fromEmail,
        fromName: input.settings.fromName,
        replyToEmail: input.settings.replyToEmail,
        configurationSet: input.settings.configurationSet,
      },
    } as never);

  try {
    const receipt = await sender.sendPasswordChanged({
      email: input.settings.recipient,
      correlationId: 'auth-ses-sandbox-smoke',
    });
    return {
      status: 'accepted',
      configurationSetEnabled: true,
      providerMessageIdPresent: Boolean(receipt.providerMessageId),
    };
  } catch (error) {
    return {
      status: 'failed',
      category: error instanceof SesEmailSenderError ? error.providerErrorCategory : 'UNKNOWN',
    };
  }
}

async function main() {
  try {
    const settings = resolveAuthSesSmokeSettings(process.env);
    const result = await runAuthSesSandboxSmoke({
      settings,
      dryRun: process.argv.includes('--dry-run'),
    });
    const output = JSON.stringify(result);
    if (result.status === 'failed') {
      console.error(output);
      process.exitCode = 1;
      return;
    }
    console.log(output);
  } catch {
    console.error(JSON.stringify({ status: 'failed', category: 'CONFIG_INVALID' }));
    process.exitCode = 64;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
