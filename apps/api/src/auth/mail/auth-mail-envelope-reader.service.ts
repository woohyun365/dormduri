import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createDecipheriv } from 'node:crypto';
import authConfig from '../../config/auth.config.js';
import type { AuthMailEnvelope } from './auth-mail-envelope.types.js';

const AES_GCM_ALGORITHM = 'aes-256-gcm';
const AES_GCM_KEY_BYTES = 32;

export type AuthMailEncryptedPayload = {
  payloadCiphertext: Uint8Array;
  payloadIv: Uint8Array;
  payloadAuthTag: Uint8Array;
  keyVersion: string;
};

@Injectable()
export class AuthMailEnvelopeReader {
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(authConfig.KEY)
    private readonly settings: ConfigType<typeof authConfig>,
  ) {
    this.encryptionKey = decodeEncryptionKey(settings.mailEnvelopeEncryptionKeyBase64);
  }

  decrypt(input: AuthMailEncryptedPayload): AuthMailEnvelope {
    if (input.keyVersion !== this.settings.mailEnvelopeKeyVersion) {
      throw new Error('[AuthMailEnvelopeReader] unsupported key version');
    }

    const decipher = createDecipheriv(AES_GCM_ALGORITHM, this.encryptionKey, input.payloadIv);
    decipher.setAAD(Buffer.from(input.keyVersion, 'utf8'));
    decipher.setAuthTag(Buffer.from(input.payloadAuthTag));
    const plaintext = Buffer.concat([
      decipher.update(input.payloadCiphertext),
      decipher.final(),
    ]).toString('utf8');

    return parseAuthMailEnvelope(plaintext);
  }
}

function parseAuthMailEnvelope(plaintext: string): AuthMailEnvelope {
  const value: unknown = JSON.parse(plaintext);
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.email !== 'string') {
    throw new Error('[AuthMailEnvelopeReader] invalid payload');
  }

  if (value.mailKind === 'PASSWORD_CHANGED') {
    return {
      schemaVersion: 1,
      mailKind: value.mailKind,
      email: value.email,
    };
  }

  if (
    (value.mailKind === 'SIGNUP_VERIFICATION' ||
      value.mailKind === 'PASSWORD_RESET_VERIFICATION') &&
    typeof value.code === 'string' &&
    typeof value.expiresInSeconds === 'number' &&
    Number.isSafeInteger(value.expiresInSeconds) &&
    value.expiresInSeconds > 0
  ) {
    return {
      schemaVersion: 1,
      mailKind: value.mailKind,
      email: value.email,
      code: value.code,
      expiresInSeconds: value.expiresInSeconds,
    };
  }

  throw new Error('[AuthMailEnvelopeReader] invalid payload');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== AES_GCM_KEY_BYTES) {
    throw new Error(
      `[AuthMailEnvelopeReader] encryption key must decode to ${AES_GCM_KEY_BYTES} bytes`,
    );
  }
  return key;
}
