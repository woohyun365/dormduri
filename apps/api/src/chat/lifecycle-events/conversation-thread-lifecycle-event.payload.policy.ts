import type { Prisma } from '../../generated/prisma/client.js';
import {
  type ConversationThreadLifecycleEventMetadata,
  type ConversationThreadLifecycleEventMetadataKey,
  type ConversationThreadLifecycleEventMetadataInput,
} from './conversation-thread-lifecycle-event.types.js';

export const CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_FORBIDDEN_KEYS = [
  'messageBody',
  'body',
  'retainedBody',
  'vaultPayload',
  'reportDetail',
  'blockNote',
  'supportBody',
  'token',
  'credential',
  'stack',
  'prismaError',
  'internalAuditPayload',
] as const;

const conversationThreadLifecycleEventMetadataAllowedKeys = [
  'sourceActiveMatchId',
  'sourceMatchRequestId',
  'sourceUnmatchRequestId',
  'sourceBlockId',
  'sourceReportCaseId',
  'sourceArchiveJobId',
  'previousStatus',
  'nextStatus',
  'previousThreadKind',
  'nextThreadKind',
  'previousClosedReason',
  'nextClosedReason',
] as const satisfies readonly ConversationThreadLifecycleEventMetadataKey[];

const allowedMetadataKeySet = new Set<string>(conversationThreadLifecycleEventMetadataAllowedKeys);
const forbiddenMetadataKeySet = new Set<string>(
  CONVERSATION_THREAD_LIFECYCLE_EVENT_METADATA_FORBIDDEN_KEYS,
);

export class ConversationThreadLifecycleEventMetadataPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationThreadLifecycleEventMetadataPolicyError';
  }
}

export function toConversationThreadLifecycleEventMetadata(
  input?: ConversationThreadLifecycleEventMetadataInput | null,
): Prisma.InputJsonValue | undefined {
  if (input == null) {
    return undefined;
  }
  if (!isPlainObject(input)) {
    throw new ConversationThreadLifecycleEventMetadataPolicyError(
      'ConversationThreadLifecycleEvent metadata must be a plain object',
    );
  }

  assertNoForbiddenMetadataKey(input);

  const metadata: ConversationThreadLifecycleEventMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowedMetadataKeySet.has(key)) {
      throw new ConversationThreadLifecycleEventMetadataPolicyError(
        `ConversationThreadLifecycleEvent metadata key is not allowed: ${key}`,
      );
    }

    metadata[key as keyof ConversationThreadLifecycleEventMetadata] = sanitizeMetadataValue(
      key,
      value,
    );
  }

  return Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined;
}

function sanitizeMetadataValue(key: string, value: unknown): string | number | boolean | null {
  if (value === undefined) {
    throw new ConversationThreadLifecycleEventMetadataPolicyError(
      `ConversationThreadLifecycleEvent metadata value must not be undefined: ${key}`,
    );
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ConversationThreadLifecycleEventMetadataPolicyError(
        `ConversationThreadLifecycleEvent metadata number must be finite: ${key}`,
      );
    }
    return value;
  }

  throw new ConversationThreadLifecycleEventMetadataPolicyError(
    `ConversationThreadLifecycleEvent metadata value must be JSON scalar: ${key}`,
  );
}

function assertNoForbiddenMetadataKey(value: unknown, seen = new WeakSet<object>()): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoForbiddenMetadataKey(item, seen);
    }
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  if (seen.has(value)) {
    return;
  }

  seen.add(value);
  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenMetadataKeySet.has(key)) {
      throw new ConversationThreadLifecycleEventMetadataPolicyError(
        `ConversationThreadLifecycleEvent metadata key is forbidden: ${key}`,
      );
    }
    assertNoForbiddenMetadataKey(nestedValue, seen);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
