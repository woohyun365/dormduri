import { describe, expect, it } from 'vitest';
import { AuthMailEnvelopeReader } from './auth-mail-envelope-reader.service.js';
import { AuthMailEnvelopeWriter } from './auth-mail-envelope-writer.service.js';

const settings = {
  mailEnvelopeEncryptionKeyBase64: 'dGVzdC1hdXRoLW1haWwtZW52ZWxvcGUta2V5LTMyYng=',
  mailEnvelopeKeyVersion: 'test-v1',
};

describe('auth mail envelope', () => {
  it('email과 code를 AES-GCM envelope로 암호화하고 같은 key version으로만 복호화한다', () => {
    const writer = new AuthMailEnvelopeWriter(settings as never);
    const reader = new AuthMailEnvelopeReader(settings as never);
    const encrypted = writer.encrypt({
      schemaVersion: 1,
      mailKind: 'PASSWORD_RESET_VERIFICATION',
      email: 'student@kangwon.ac.kr',
      code: '123456',
      expiresInSeconds: 600,
    });

    expect(Buffer.from(encrypted.payloadCiphertext).toString('utf8')).not.toContain(
      'student@kangwon.ac.kr',
    );
    expect(reader.decrypt(encrypted)).toEqual({
      schemaVersion: 1,
      mailKind: 'PASSWORD_RESET_VERIFICATION',
      email: 'student@kangwon.ac.kr',
      code: '123456',
      expiresInSeconds: 600,
    });
  });

  it('ciphertext가 변조되면 인증 태그 검증으로 복호화를 거절한다', () => {
    const writer = new AuthMailEnvelopeWriter(settings as never);
    const reader = new AuthMailEnvelopeReader(settings as never);
    const encrypted = writer.encrypt({
      schemaVersion: 1,
      mailKind: 'PASSWORD_CHANGED',
      email: 'student@kangwon.ac.kr',
    });
    encrypted.payloadCiphertext[0] = (encrypted.payloadCiphertext[0] ?? 0) ^ 1;

    expect(() => reader.decrypt(encrypted)).toThrow();
  });
});
