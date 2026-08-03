import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUTH_PASSWORD_BLOCKLIST_REFERENCE,
  validateAuthPasswordBlocklistReference,
} from './password-policy/password-blocklist.reference.js';
import { authPasswordBlocklistSize } from './password-policy/password-blocklist.lookup.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

describe('auth password policy boundary', () => {
  it('reference와 in-memory exact lookup의 개수·형식이 일치한다', () => {
    expect(() => validateAuthPasswordBlocklistReference()).not.toThrow();
    expect(authPasswordBlocklistSize()).toBe(AUTH_PASSWORD_BLOCKLIST_REFERENCE.length);
    expect(new Set(AUTH_PASSWORD_BLOCKLIST_REFERENCE).size).toBe(
      AUTH_PASSWORD_BLOCKLIST_REFERENCE.length,
    );
  });

  it('private password policy는 public-text moderation과 logging dependency를 사용하지 않는다', () => {
    const serviceSource = readFileSync(
      path.join(CURRENT_DIR, 'password-policy.service.ts'),
      'utf8',
    );
    const lookupSource = readFileSync(
      path.join(CURRENT_DIR, 'password-policy/password-blocklist.lookup.ts'),
      'utf8',
    );
    const combinedSource = `${serviceSource}\n${lookupSource}`;

    expect(combinedSource).not.toContain('/moderation/');
    expect(combinedSource).not.toContain('ModerationService');
    expect(combinedSource).not.toContain('Logger');
    expect(combinedSource).not.toContain('console.');
  });
});
