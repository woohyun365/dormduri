import { createCipheriv, createDecipheriv, randomBytes, type CipherGCMTypes } from 'node:crypto';

export const RETENTION_CIPHER_ALGORITHM = 'aes-256-gcm' satisfies CipherGCMTypes;

export interface RetentionCipher {
  keyVersion: string;
  key: Buffer;
}

export interface EncryptedRetentionPayload {
  schemaVersion: 1;
  algorithm: typeof RETENTION_CIPHER_ALGORITHM;
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function createRetentionCipher(input: {
  key: string | Buffer;
  keyVersion: string;
  errorPrefix: string;
}): RetentionCipher {
  const key = typeof input.key === 'string' ? Buffer.from(input.key, 'base64') : input.key;
  if (key.length !== 32) {
    throw new Error(`${input.errorPrefix} encryption key must be 32 bytes`);
  }
  if (!input.keyVersion.trim()) {
    throw new Error(`${input.errorPrefix} keyVersion is required`);
  }
  return { key: Buffer.from(key), keyVersion: input.keyVersion.trim() };
}

export function encryptJsonPayload<T>(input: {
  cipher: RetentionCipher;
  plaintext: T;
  aad: Buffer;
}): EncryptedRetentionPayload {
  const iv = randomBytes(12);
  const nodeCipher = createCipheriv(RETENTION_CIPHER_ALGORITHM, input.cipher.key, iv);
  nodeCipher.setAAD(input.aad);
  const ciphertext = Buffer.concat([
    nodeCipher.update(JSON.stringify(input.plaintext), 'utf8'),
    nodeCipher.final(),
  ]);

  return {
    schemaVersion: 1,
    algorithm: RETENTION_CIPHER_ALGORITHM,
    keyVersion: input.cipher.keyVersion,
    iv: iv.toString('base64'),
    authTag: nodeCipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptJsonPayload<T>(input: {
  cipher: RetentionCipher;
  payload: unknown;
  aad: Buffer;
  errorPrefix: string;
  parsePlaintext: (payload: unknown) => T;
}): T {
  const encryptedPayload = parseEncryptedRetentionPayload(input.payload, input.errorPrefix);
  if (encryptedPayload.keyVersion !== input.cipher.keyVersion) {
    throw new Error(`${input.errorPrefix} key version mismatch`);
  }

  const decipher = createDecipheriv(
    RETENTION_CIPHER_ALGORITHM,
    input.cipher.key,
    Buffer.from(encryptedPayload.iv, 'base64'),
  );
  decipher.setAAD(input.aad);
  decipher.setAuthTag(Buffer.from(encryptedPayload.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedPayload.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return input.parsePlaintext(JSON.parse(plaintext.toString('utf8')));
}

export function parseEncryptedRetentionPayload(
  payload: unknown,
  errorPrefix: string,
): EncryptedRetentionPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`${errorPrefix} encrypted payload missing`);
  }

  const candidate = payload as Partial<Record<keyof EncryptedRetentionPayload, unknown>>;
  if (
    candidate.schemaVersion !== 1 ||
    candidate.algorithm !== RETENTION_CIPHER_ALGORITHM ||
    typeof candidate.keyVersion !== 'string' ||
    typeof candidate.iv !== 'string' ||
    typeof candidate.authTag !== 'string' ||
    typeof candidate.ciphertext !== 'string'
  ) {
    throw new Error(`${errorPrefix} encrypted payload invalid`);
  }

  return candidate as EncryptedRetentionPayload;
}
