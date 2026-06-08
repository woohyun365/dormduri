export const NOTIFICATION_FORBIDDEN_PAYLOAD_KEYS = [
  'body',
  'messageBody',
  'supportBody',
  'supportMessageBody',
  'reportDetail',
  'rawReportDetail',
  'reportEvidenceBody',
  'blockNote',
  'rrpdPayload',
  'retainedIdentityPayload',
  'originalBody',
  'retainedOriginalBody',
  'retainedVaultObjectId',
  'retainedVaultObject',
  'encryptedPayload',
  'vaultPayload',
  'retainedVaultPayload',
  'rawRetainedBody',
  'internalAuditData',
  'retentionAccessLog',
  'approvalReference',
  'accessedBy',
  'disclosedFields',
  'retentionCaseId',
  'email',
  'nickname',
  'nicknameNormalized',
  'fullIdentity',
  'displayIdentity',
  'academicIdentity',
] as const;

const forbiddenPayloadKeys = new Set<string>(NOTIFICATION_FORBIDDEN_PAYLOAD_KEYS);

export function assertNotificationPayloadAllowed(payload: unknown): void {
  const forbiddenKey = findForbiddenPayloadKey(payload);
  if (forbiddenKey) {
    throw new Error(`[notification-payload-policy] forbidden payload key: ${forbiddenKey}`);
  }
}

export function isNotificationPayloadPrivacySafe(payload: unknown): boolean {
  return findForbiddenPayloadKey(payload) === null;
}

export function toChatThreadCreatedNotificationPayload(input: {
  threadId: string;
  actorUserId: string;
  recipientUserId: string;
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'CHAT_THREAD_CREATED' as const,
    threadId: input.threadId,
    actorUserId: input.actorUserId,
    recipientUserId: input.recipientUserId,
    occurredAt: input.occurredAt.toISOString(),
  });
}

function assertAllowedPayload<T>(payload: T): T {
  assertNotificationPayloadAllowed(payload);
  return payload;
}

function findForbiddenPayloadKey(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findForbiddenPayloadKey(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (forbiddenPayloadKeys.has(key)) {
      return key;
    }

    const nested = findForbiddenPayloadKey(nestedValue);
    if (nested) {
      return nested;
    }
  }

  return null;
}
