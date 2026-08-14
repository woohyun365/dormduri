import { describe, expect, it, vi } from 'vitest';
import { resolveAuthSesSmokeSettings, runAuthSesSandboxSmoke } from './auth-ses-sandbox-smoke.js';

const settings = {
  region: 'ap-northeast-2',
  fromEmail: 'no-reply@example.com',
  fromName: 'KNU Roommate',
  replyToEmail: null,
  configurationSet: 'knu-roommate-staging',
  recipient: 'success@simulator.amazonses.com',
};

describe('auth SES sandbox smoke', () => {
  it('SES provider, Configuration Set과 recipient가 모두 있어야 실행된다', () => {
    expect(() => resolveAuthSesSmokeSettings({ EMAIL_PROVIDER: 'stub' })).toThrow(
      'EMAIL_PROVIDER=ses is required',
    );
    expect(() =>
      resolveAuthSesSmokeSettings({
        EMAIL_PROVIDER: 'ses',
        SES_REGION: 'ap-northeast-2',
        SES_FROM_EMAIL: 'no-reply@example.com',
      }),
    ).toThrow('configurationSet, recipient');
  });

  it('dry-run은 provider를 호출하지 않고 설정 경계만 확인한다', async () => {
    const sender = { sendPasswordChanged: vi.fn() };

    await expect(
      runAuthSesSandboxSmoke({ settings, dryRun: true, sender: sender as never }),
    ).resolves.toEqual({ status: 'dry-run', configurationSetEnabled: true });
    expect(sender.sendPasswordChanged).not.toHaveBeenCalled();
  });

  it('실제 smoke 결과는 recipient 없이 bounded acceptance 정보만 반환한다', async () => {
    const sender = {
      sendPasswordChanged: vi.fn().mockResolvedValue({ providerMessageId: 'message-id' }),
    };

    const result = await runAuthSesSandboxSmoke({
      settings,
      dryRun: false,
      sender: sender as never,
    });

    expect(result).toEqual({
      status: 'accepted',
      configurationSetEnabled: true,
      providerMessageIdPresent: true,
    });
    expect(JSON.stringify(result)).not.toContain(settings.recipient);
  });
});
