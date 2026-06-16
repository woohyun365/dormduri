import { describe, expect, it } from 'vitest';
import { LOG_REDACTED_VALUE, redactLogValue } from './log-redaction.policy.js';

describe('log redaction policy', () => {
  it('redacts forbidden payload keys recursively while preserving safe operational fields', () => {
    const result = redactLogValue({
      route: '/api/auth/login',
      method: 'POST',
      statusCode: 401,
      nested: {
        email: 'student@knu.ac.kr',
        password: 'secret',
        accessToken: 'token-value',
        requestBody: { raw: true },
        safeOutcome: 'blocked',
      },
    });

    expect(result).toEqual({
      route: '/api/auth/login',
      method: 'POST',
      statusCode: 401,
      nested: {
        email: LOG_REDACTED_VALUE,
        password: LOG_REDACTED_VALUE,
        accessToken: LOG_REDACTED_VALUE,
        requestBody: LOG_REDACTED_VALUE,
        safeOutcome: 'blocked',
      },
    });
  });

  it('sanitizes obvious credentials embedded in string messages', () => {
    expect(
      redactLogValue(
        'login failed email=student@knu.ac.kr Authorization=Bearer abc.def token=secret',
      ),
    ).toBe(
      `login failed email=${LOG_REDACTED_VALUE} Authorization=Bearer ${LOG_REDACTED_VALUE} token=${LOG_REDACTED_VALUE}`,
    );
  });

  it('does not expand Error objects into raw stack traces', () => {
    expect(redactLogValue(new TypeError('secret stack'))).toEqual({ errorName: 'TypeError' });
  });
});
