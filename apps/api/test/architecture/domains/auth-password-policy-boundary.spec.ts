import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUTH_PASSWORD_BLOCKLIST_REFERENCE,
  validateAuthPasswordBlocklistReference,
} from '../../../src/auth/credentials/password-policy/password-blocklist.reference.js';
import { authPasswordBlocklistSize } from '../../../src/auth/credentials/password-policy/password-blocklist.lookup.js';

const passwordPolicyRoot = join(process.cwd(), 'src/auth/credentials/password-policy');

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
      join(passwordPolicyRoot, 'auth-password-policy.service.ts'),
      'utf8',
    );
    const lookupSource = readFileSync(
      join(passwordPolicyRoot, 'password-blocklist.lookup.ts'),
      'utf8',
    );
    const structureSource = readFileSync(
      join(passwordPolicyRoot, 'auth-password-structure.policy.ts'),
      'utf8',
    );
    const combinedSource = `${serviceSource}\n${lookupSource}\n${structureSource}`;

    expect(combinedSource).not.toContain('/moderation/');
    expect(combinedSource).not.toContain('ModerationService');
    expect(combinedSource).not.toContain('Logger');
    expect(combinedSource).not.toContain('console.');
  });
});
