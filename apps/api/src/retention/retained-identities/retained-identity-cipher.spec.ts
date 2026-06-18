import { describe, expect, it } from 'vitest';
import {
  createRetainedIdentityCipher,
  decryptRetainedIdentifierPayload,
  encryptRetainedIdentifierPayload,
} from './retained-identity-cipher.js';

describe('retained-identity-cipher', () => {
  it('retained identity 식별자 payload는 keyVersion이 맞는 암호키로만 복원된다', () => {
    const cipher = createRetainedIdentityCipher({
      key: Buffer.alloc(32, 7),
      keyVersion: 'test-v1',
    });
    const encrypted = encryptRetainedIdentifierPayload(cipher, {
      schemaVersion: 1,
      originalUserId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      emailNormalized: 'user-a@kangwon.ac.kr',
    });

    expect(encrypted).toMatchObject({
      schemaVersion: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'test-v1',
    });
    expect(decryptRetainedIdentifierPayload(cipher, encrypted)).toEqual({
      schemaVersion: 1,
      originalUserId: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      emailNormalized: 'user-a@kangwon.ac.kr',
    });
    expect(() =>
      decryptRetainedIdentifierPayload(
        createRetainedIdentityCipher({ key: Buffer.alloc(32, 8), keyVersion: 'test-other' }),
        encrypted,
      ),
    ).toThrow('key version mismatch');
  });
});
