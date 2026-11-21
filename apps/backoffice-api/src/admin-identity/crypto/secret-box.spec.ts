import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretBox } from './secret-box.js';

describe('SecretBox (AES-256-GCM)', () => {
  const box = new SecretBox(randomBytes(32));
  const secret = randomBytes(20);

  it('opens what it sealed for the same account', () => {
    const sealed = box.seal(secret, 'admin-totp:account-a');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain(secret.toString('base64url'));
    expect(box.open(sealed, 'admin-totp:account-a').equals(secret)).toBe(true);
  });

  it('refuses a ciphertext moved to another account or altered', () => {
    const sealed = box.seal(secret, 'admin-totp:account-a');
    expect(() => box.open(sealed, 'admin-totp:account-b')).toThrow();
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => box.open(parts.join('.'), 'admin-totp:account-a')).toThrow();
  });

  it('refuses another key', () => {
    const sealed = box.seal(secret, 'admin-totp:account-a');
    expect(() => new SecretBox(randomBytes(32)).open(sealed, 'admin-totp:account-a')).toThrow();
    expect(() => new SecretBox(randomBytes(16))).toThrow();
  });
});
