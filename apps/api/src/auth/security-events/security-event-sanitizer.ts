import { createHash } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  AuthSecurityEventInput,
  AuthSecurityEventSeverity,
} from './auth-security-event.types.js';

const SENSITIVE_METADATA_KEY_PATTERN = /password|token|secret|code|credential|hash/i;

export function hashAuthSecurityEventDimension(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return createHash('sha256').update(normalized).digest('hex');
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function sanitizeAuthSecurityEventMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  const safeEntries = Object.entries(metadata).filter(([key, value]) => {
    return !SENSITIVE_METADATA_KEY_PATTERN.test(key) && isJsonPrimitive(value);
  });

  if (safeEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(safeEntries) as Prisma.InputJsonObject;
}

export function defaultAuthSecurityEventSeverity(
  type: AuthSecurityEventInput['type'],
): AuthSecurityEventSeverity {
  switch (type) {
    case 'LOGIN_LOCKOUT':
    case 'MAIL_SEND_FAILURE':
    case 'OPAQUE_TRANSPORT_REJECTED':
    case 'SESSION_TOKEN_REUSE_DETECTED':
    case 'VERIFICATION_CODE_VERIFY_FAILURE':
      return 'WARNING';
    default:
      return 'INFO';
  }
}
