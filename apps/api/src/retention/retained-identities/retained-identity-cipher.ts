import {
  createRetentionCipher,
  decryptJsonPayload,
  encryptJsonPayload,
} from '../crypto/retention-cipher.js';
import type {
  EncryptedRetainedIdentifierPayload,
  RetainedIdentifierPlaintext,
  RetainedIdentityCipher,
} from './retained-identity.types.js';

const RETAINED_IDENTIFIER_KEY_ENV = 'RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64';
const RETAINED_IDENTIFIER_KEY_VERSION_ENV = 'RETENTION_IDENTITY_KEY_VERSION';
const DEFAULT_RETAINED_IDENTIFIER_KEY_VERSION = 'local-v1';
const RETAINED_IDENTIFIER_AAD = Buffer.from('knu-roommate:retained-identity:v1');

export function createRetainedIdentityCipher(input: {
  key: string | Buffer;
  keyVersion: string;
}): RetainedIdentityCipher {
  return createRetentionCipher({
    key: input.key,
    keyVersion: input.keyVersion,
    errorPrefix: '[retained-identity-owner]',
  });
}

export function encryptRetainedIdentifierPayload(
  cipher: RetainedIdentityCipher,
  plaintext: RetainedIdentifierPlaintext,
): EncryptedRetainedIdentifierPayload {
  return encryptJsonPayload({
    cipher,
    plaintext,
    aad: RETAINED_IDENTIFIER_AAD,
  });
}

export function decryptRetainedIdentifierPayload(
  cipher: RetainedIdentityCipher,
  payload: unknown,
): RetainedIdentifierPlaintext {
  return decryptJsonPayload({
    cipher,
    payload,
    aad: RETAINED_IDENTIFIER_AAD,
    errorPrefix: '[retained-identity-owner] retained identity',
    parsePlaintext: parseRetainedIdentifierPlaintext,
  });
}

export function resolveRetainedIdentityCipher(
  cipherOverride: RetainedIdentityCipher | null | undefined,
): RetainedIdentityCipher | null {
  if (cipherOverride !== undefined) {
    return cipherOverride;
  }

  const rawKey = process.env[RETAINED_IDENTIFIER_KEY_ENV]?.trim();
  if (!rawKey) {
    return null;
  }

  return createRetainedIdentityCipher({
    key: rawKey,
    keyVersion:
      process.env[RETAINED_IDENTIFIER_KEY_VERSION_ENV]?.trim() ||
      DEFAULT_RETAINED_IDENTIFIER_KEY_VERSION,
  });
}

function parseRetainedIdentifierPlaintext(payload: unknown): RetainedIdentifierPlaintext {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[retained-identity-owner] identifier plaintext invalid');
  }

  const candidate = payload as Partial<Record<keyof RetainedIdentifierPlaintext, unknown>>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.originalUserId !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.emailNormalized !== 'string'
  ) {
    throw new Error('[retained-identity-owner] identifier plaintext invalid');
  }

  return candidate as RetainedIdentifierPlaintext;
}
