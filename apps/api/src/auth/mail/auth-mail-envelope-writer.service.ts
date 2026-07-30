import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createCipheriv, randomBytes } from 'node:crypto';
import authConfig from '../../config/auth.config.js';
import type { AuthMailEnvelope, EncryptedAuthMailEnvelope } from './auth-mail-envelope.types.js';

const AES_GCM_ALGORITHM = 'aes-256-gcm';
const AES_GCM_IV_BYTES = 12;
const AES_GCM_KEY_BYTES = 32;

@Injectable()
export class AuthMailEnvelopeWriter {
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(authConfig.KEY)
    private readonly settings: ConfigType<typeof authConfig>,
  ) {
    this.encryptionKey = decodeEncryptionKey(settings.mailEnvelopeEncryptionKeyBase64);
  }

  encrypt(payload: AuthMailEnvelope): EncryptedAuthMailEnvelope {
    const payloadIv = randomBytes(AES_GCM_IV_BYTES);
    const cipher = createCipheriv(AES_GCM_ALGORITHM, this.encryptionKey, payloadIv);
    cipher.setAAD(Buffer.from(this.settings.mailEnvelopeKeyVersion, 'utf8'));
    const payloadCiphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);

    return {
      payloadCiphertext,
      payloadIv,
      payloadAuthTag: cipher.getAuthTag(),
      keyVersion: this.settings.mailEnvelopeKeyVersion,
    };
  }
}

function decodeEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== AES_GCM_KEY_BYTES) {
    throw new Error(
      `[AuthMailEnvelopeWriter] encryption key must decode to ${AES_GCM_KEY_BYTES} bytes`,
    );
  }
  return key;
}
