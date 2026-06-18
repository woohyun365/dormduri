import { describe, expect, it } from 'vitest';
import {
  SECRET_PLACEHOLDER_REDACTED_VALUE,
  SECRET_REDACTED_VALUE,
  redactSecretError,
  redactSecretText,
} from './secret-redaction.js';

describe('secret redaction', () => {
  it('redacts database URL credentials and credential assignments', () => {
    const redacted = redactSecretText(
      'DATABASE_URL=postgresql://api:super-secret@db.internal/api METRICS_BEARER_TOKEN=token-123',
    );

    expect(redacted).toBe(
      `DATABASE_URL=postgresql://api:${SECRET_REDACTED_VALUE}@db.internal/api METRICS_BEARER_TOKEN=${SECRET_REDACTED_VALUE}`,
    );
    expect(redacted).not.toContain('super-secret');
    expect(redacted).not.toContain('token-123');
  });

  it('redacts explicit HMAC/base64 secret samples', () => {
    const secret = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
    const redacted = redactSecretText(`loaded secret ${secret}`, [secret]);

    expect(redacted).toBe(`loaded secret ${SECRET_REDACTED_VALUE}`);
    expect(redacted).not.toContain(secret);
  });

  it('redacts replacement placeholders and bearer tokens', () => {
    const redacted = redactSecretText(
      'Authorization=Bearer abc.def placeholder REPLACE_WITH_REAL_VALUE',
    );

    expect(redacted).toContain(`Bearer ${SECRET_REDACTED_VALUE}`);
    expect(redacted).toContain(SECRET_PLACEHOLDER_REDACTED_VALUE);
    expect(redacted).not.toContain('abc.def');
    expect(redacted).not.toContain('REPLACE_WITH_REAL_VALUE');
  });

  it('sanitizes error messages without leaking raw values', () => {
    const rawSecret = 'raw-error-secret';
    const result = redactSecretError(new Error(`failed with ${rawSecret}`), [rawSecret]);

    expect(result).toEqual({ name: 'Error', message: `failed with ${SECRET_REDACTED_VALUE}` });
  });
});
