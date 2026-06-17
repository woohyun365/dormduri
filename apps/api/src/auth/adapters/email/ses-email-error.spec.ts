import { describe, expect, it } from 'vitest';
import {
  SesEmailSenderError,
  mapSesEmailErrorCategory,
  toSesEmailSenderError,
} from './ses-email-error.js';

function awsError(name: string) {
  return Object.assign(new Error(`raw ${name} provider detail`), { name });
}

describe('SES email error mapping', () => {
  it.each([
    ['AccessDeniedException', 'ACCESS_DENIED'],
    ['BadRequestException', 'CONFIG_INVALID'],
    ['MessageRejected', 'MESSAGE_REJECTED'],
    ['MailFromDomainNotVerifiedException', 'MESSAGE_REJECTED'],
    ['TooManyRequestsException', 'THROTTLED'],
    ['ServiceUnavailableException', 'TRANSIENT'],
    ['UnexpectedProviderError', 'UNKNOWN'],
  ] as const)('maps %s to %s', (name, category) => {
    expect(mapSesEmailErrorCategory(awsError(name))).toBe(category);
  });

  it('wraps raw provider errors with bounded category only', () => {
    const error = toSesEmailSenderError(awsError('TooManyRequestsException'));

    expect(error).toBeInstanceOf(SesEmailSenderError);
    expect(error.providerErrorCategory).toBe('THROTTLED');
    expect(error.message).toBe('SES email send failed: THROTTLED');
    expect(error.message).not.toContain('raw');
  });
});
