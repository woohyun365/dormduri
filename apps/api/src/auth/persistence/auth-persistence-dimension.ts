import { createHmac } from 'node:crypto';

const AUTH_PERSISTENCE_KEY_VERSION = 'v1';

export type AuthPersistenceDimension = 'subject' | 'request-ip' | 'user-agent';

export function hashAuthPersistenceDimension(
  dimension: AuthPersistenceDimension,
  value: string,
  secret: string,
): string {
  const normalized = value.trim().toLowerCase();
  const digest = createHmac('sha256', secret)
    .update(`${AUTH_PERSISTENCE_KEY_VERSION}\0${dimension}\0${normalized}`)
    .digest('hex');

  return `${AUTH_PERSISTENCE_KEY_VERSION}:${digest}`;
}
