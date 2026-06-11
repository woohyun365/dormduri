const SUPPORT_NOTIFICATION_FORBIDDEN_KEYS = new Set([
  'body',
  'messageBody',
  'supportBody',
  'supportMessageBody',
  'email',
  'rawAppealDetail',
  'rrpdPayload',
  'retainedVaultPayload',
]);

export function assertSupportNotificationPayloadSafe(payload: unknown): void {
  const forbiddenKey = findForbiddenPayloadKey(payload);
  if (forbiddenKey) {
    throw new Error(`[support-payload-policy] forbidden payload key: ${forbiddenKey}`);
  }
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
  for (const [key, nested] of Object.entries(value)) {
    if (SUPPORT_NOTIFICATION_FORBIDDEN_KEYS.has(key)) {
      return key;
    }
    const nestedForbiddenKey = findForbiddenPayloadKey(nested);
    if (nestedForbiddenKey) {
      return nestedForbiddenKey;
    }
  }
  return null;
}
