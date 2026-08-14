import { describe, expect, it, vi } from 'vitest';
import {
  EmailSenderProviderConfigError,
  selectEmailSenderDelegate,
} from './email-sender.provider.js';
import type { EmailSender } from './email-sender.interface.js';

const stub = {
  sendVerificationCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  sendPasswordChanged: vi.fn(),
} satisfies EmailSender;
const ses = {
  sendVerificationCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  sendPasswordChanged: vi.fn(),
} satisfies EmailSender;

describe('selectEmailSenderDelegate', () => {
  it('keeps stub sender available outside production', () => {
    expect(selectEmailSenderDelegate({ provider: 'stub' }, { stub, ses }, 'test')).toBe(stub);
  });

  it('selects SES sender when EMAIL_PROVIDER=ses', () => {
    expect(selectEmailSenderDelegate({ provider: 'ses' }, { stub, ses }, 'production')).toBe(ses);
  });

  it('fails fast when production attempts to use stub sender', () => {
    expect(() =>
      selectEmailSenderDelegate({ provider: 'stub' }, { stub, ses }, 'production'),
    ).toThrow(EmailSenderProviderConfigError);
  });
});
