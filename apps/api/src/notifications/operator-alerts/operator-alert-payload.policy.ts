import type { OperatorAlertSinkPayload } from './operator-alert-sink.port.js';
import { assertNotificationPayloadAllowed } from '../policies/notification-payload.policy.js';

export type OperatorAlertRecordPayload = Omit<OperatorAlertSinkPayload, 'alertId'>;

export const OPERATOR_ALERT_ALLOWED_PAYLOAD_KEYS = [
  'sourceType',
  'sourceId',
  'category',
  'riskTier',
  'severity',
  'occurredAt',
] as const;

const allowedPayloadKeys = new Set<string>(OPERATOR_ALERT_ALLOWED_PAYLOAD_KEYS);

export function assertOperatorAlertPayloadAllowed(payload: OperatorAlertRecordPayload): void {
  assertNotificationPayloadAllowed(payload);

  for (const key of Object.keys(payload)) {
    if (!allowedPayloadKeys.has(key)) {
      throw new Error(`[operator-alert-payload-policy] forbidden payload key: ${key}`);
    }
  }
}

export function toOperatorAlertRecordPayload(input: OperatorAlertRecordPayload) {
  assertOperatorAlertPayloadAllowed(input);
  return input;
}
