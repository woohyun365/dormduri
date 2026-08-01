import { createHmac } from 'node:crypto';

const DEFAULT_AUTH_PERSISTENCE_KEY_VERSION = 'v1';

export type AuthPersistenceDimension = 'subject' | 'request-ip' | 'user-agent';

export function hashAuthPersistenceDimension(
  dimension: AuthPersistenceDimension,
  value: string,
  secret: string,
  keyVersion: string = DEFAULT_AUTH_PERSISTENCE_KEY_VERSION,
): string {
  const normalized = value.trim().toLowerCase();
  const normalizedKeyVersion = normalizeKeyVersion(keyVersion);
  const digest = createHmac('sha256', secret)
    .update(`${normalizedKeyVersion}\0${dimension}\0${normalized}`)
    .digest('hex');

  return `${normalizedKeyVersion}:${digest}`;
}

function normalizeKeyVersion(keyVersion: string) {
  const normalized = keyVersion.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(normalized)) {
    throw new Error('[AuthPersistenceDimension] invalid HMAC key version');
  }
  return normalized;
}
