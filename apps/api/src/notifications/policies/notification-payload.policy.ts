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

export function toReportReceivedNotificationPayload(input: { reportId: string; occurredAt: Date }) {
  return assertAllowedPayload({
    kind: 'REPORT_RECEIVED' as const,
    reportId: input.reportId,
    status: 'RECEIVED' as const,
    occurredAt: input.occurredAt.toISOString(),
  });
}

export function toProfileMismatchFeedbackNotificationPayload(input: {
  reportId: string;
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'PROFILE_MISMATCH_FEEDBACK' as const,
    reportId: input.reportId,
    promptCode: 'PROFILE_REVIEW_NEXT_SEASON' as const,
    occurredAt: input.occurredAt.toISOString(),
  });
}

export function toSeasonSystemNoticeNotificationPayload(input: {
  campaignId: string;
  seasonId?: string | null;
  noticeCode: string;
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'SEASON_SYSTEM_NOTICE' as const,
    campaignId: input.campaignId,
    seasonId: input.seasonId ?? null,
    noticeCode: input.noticeCode,
    occurredAt: input.occurredAt.toISOString(),
  });
}

export function toSupportTicketCreatedNotificationPayload(input: {
  supportTicketId: string;
  category: string;
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'SUPPORT_TICKET_CREATED' as const,
    supportTicketId: input.supportTicketId,
    category: input.category,
    status: 'OPEN' as const,
    occurredAt: input.occurredAt.toISOString(),
  });
}

export function toSupportTicketRepliedNotificationPayload(input: {
  supportTicketId: string;
  status: 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'SUPPORT_TICKET_REPLIED' as const,
    supportTicketId: input.supportTicketId,
    status: input.status,
    occurredAt: input.occurredAt.toISOString(),
  });
}

export function toSupportTicketActionRequiredNotificationPayload(input: {
  supportTicketId: string;
  actionCode: string;
  occurredAt: Date;
}) {
  return assertAllowedPayload({
    kind: 'SUPPORT_TICKET_ACTION_REQUIRED' as const,
    supportTicketId: input.supportTicketId,
    actionCode: input.actionCode,
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
