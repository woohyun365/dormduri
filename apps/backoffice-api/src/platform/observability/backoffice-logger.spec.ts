import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { BackofficeLogger, LOG_REDACTED, redactLogValue } from './backoffice-logger.js';

describe('backoffice log redaction (OA-R7)', () => {
  it('drops secrets, codes, tokens, passkey responses and account identifiers by key', () => {
    expect(
      redactLogValue({
        password: 'hunter2hunter2',
        code: '123456',
        recoveryCode: 'ABCDE-FGHIJ',
        token: 'x',
        credential: { response: { signature: 'sig' } },
        email: 'operator@example.com',
        reason: 'free text',
        step: 'password',
        nested: { authorization: 'Bearer abc', challengeId: 'id' },
      }),
    ).toEqual({
      password: LOG_REDACTED,
      code: LOG_REDACTED,
      recoveryCode: LOG_REDACTED,
      token: LOG_REDACTED,
      credential: LOG_REDACTED,
      email: LOG_REDACTED,
      reason: LOG_REDACTED,
      step: 'password',
      nested: { authorization: LOG_REDACTED, challengeId: LOG_REDACTED },
    });
  });

  it('masks emails, bearer values and long tokens inside free strings', () => {
    expect(redactLogValue(`login of operator@example.com with Bearer ${'t'.repeat(43)}`)).toBe(
      `login of ${LOG_REDACTED} with Bearer ${LOG_REDACTED}`,
    );
    expect(redactLogValue('session abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ')).toBe(
      `session ${LOG_REDACTED}`,
    );
  });

  it('keeps UUID ids so a log line can be matched to its audit row', () => {
    const requestId = '6f1c2a5e-0b7d-4c3e-9a8f-1d2e3f4a5b6c';
    expect(redactLogValue({ requestId })).toEqual({ requestId });
  });

  it('writes the redacted fields as one JSON line', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString('utf8'));
        done();
      },
    });
    new BackofficeLogger('info', sink).event('info', 'example', {
      password: 'secret-value',
      step: 1,
    });
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(line).toMatchObject({
      level: 'info',
      event: 'example',
      password: LOG_REDACTED,
      step: 1,
    });
    expect(lines[0]).not.toContain('secret-value');
  });
});
