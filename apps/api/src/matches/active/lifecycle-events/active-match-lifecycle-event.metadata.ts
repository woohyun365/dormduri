import type { Prisma } from '../../../generated/prisma/client.js';
import {
  ACTIVE_MATCH_LIFECYCLE_METADATA_KEYS,
  type ActiveMatchLifecycleMetadataInput,
} from './active-match-lifecycle-event.types.js';

type JsonPlainObject = { [key: string]: JsonMetadataValue };
type JsonMetadataValue = string | number | boolean | null | JsonPlainObject;

const metadataKeySet = new Set<string>(ACTIVE_MATCH_LIFECYCLE_METADATA_KEYS);
const forbiddenMetadataKeySet = new Set<string>([
  'note',
  'profile',
  'lifestyle',
  'chatBody',
  'messageBody',
  'retainedBody',
  'vaultPayload',
  'email',
  'phone',
  'token',
  'providerAccessToken',
  'requestBody',
  'responseBody',
  'stack',
  'prismaError',
  'internalAuditPayload',
  'identitySnapshot',
]);

export function toActiveMatchLifecycleEventMetadata(
  input?: ActiveMatchLifecycleMetadataInput | null,
): Prisma.InputJsonValue | undefined {
  if (!input) {
    return undefined;
  }

  const metadata: Record<string, JsonMetadataValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!metadataKeySet.has(key)) {
      continue;
    }

    const sanitizedValue = sanitizeMetadataValue(value);
    if (sanitizedValue !== undefined) {
      metadata[key] = sanitizedValue;
    }
  }

  return Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined;
}

function sanitizeMetadataValue(value: unknown): JsonMetadataValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (!isPlainObject(value)) {
    return undefined;
  }

  const nested: Record<string, JsonMetadataValue> = {};
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    if (forbiddenMetadataKeySet.has(nestedKey)) {
      continue;
    }

    const sanitizedNestedValue = sanitizeMetadataValue(nestedValue);
    if (sanitizedNestedValue !== undefined) {
      nested[nestedKey] = sanitizedNestedValue;
    }
  }

  return Object.keys(nested).length > 0 ? nested : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
