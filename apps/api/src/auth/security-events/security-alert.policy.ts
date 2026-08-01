import type { AuthSecurityEventType } from './auth-security-event.types.js';

export const AUTH_SECURITY_ALERT_KINDS = {
  LOGIN_FAILURE_SPIKE: 'login-failure-spike',
  RESET_REQUEST_SPIKE: 'reset-request-spike',
  MAIL_FAILURE_SPIKE: 'mail-failure-spike',
  MAIL_OUTBOX_LAG_HIGH: 'mail-outbox-lag-high',
} as const;

export const AUTH_SECURITY_ALERT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_FAILURE_SPIKE_THRESHOLD = 5;
const RESET_REQUEST_SPIKE_THRESHOLD = 6;
const MAIL_FAILURE_SPIKE_THRESHOLD = 3;

export interface AuthSecurityAlertEvent {
  type: AuthSecurityEventType;
  subjectKey?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}

export interface AuthSecurityAlert {
  kind: (typeof AUTH_SECURITY_ALERT_KINDS)[keyof typeof AUTH_SECURITY_ALERT_KINDS];
  dimension: 'subject' | 'provider' | 'outbox';
  count: number;
  recommendedAction:
    | 'consider-step-up-or-captcha'
    | 'review-reset-abuse-and-delivery-health'
    | 'check-email-provider-and-alert-channel'
    | 'inspect-mail-outbox-dispatcher';
}

function isWithinWindow(event: AuthSecurityAlertEvent, now: Date) {
  const ageMs = now.getTime() - event.createdAt.getTime();
  return ageMs >= 0 && ageMs <= AUTH_SECURITY_ALERT_WINDOW_MS;
}

function countBySubjectKey(
  events: readonly AuthSecurityAlertEvent[],
  type: AuthSecurityEventType,
  predicate: (event: AuthSecurityAlertEvent) => boolean = () => true,
) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== type || !event.subjectKey || !predicate(event)) {
      continue;
    }
    counts.set(event.subjectKey, (counts.get(event.subjectKey) ?? 0) + 1);
  }

  return [...counts.values()].sort((left, right) => right - left)[0] ?? 0;
}

export function evaluateAuthSecurityEventAlerts(
  events: readonly AuthSecurityAlertEvent[],
  now: Date = new Date(),
  input: { mailOutboxLagSeconds?: number; mailOutboxLagAlertSeconds?: number } = {},
): AuthSecurityAlert[] {
  const recentEvents = events.filter((event) => isWithinWindow(event, now));
  const alerts: AuthSecurityAlert[] = [];

  const loginFailureCount = countBySubjectKey(recentEvents, 'LOGIN_FAILURE');
  if (loginFailureCount >= LOGIN_FAILURE_SPIKE_THRESHOLD) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.LOGIN_FAILURE_SPIKE,
      dimension: 'subject',
      count: loginFailureCount,
      recommendedAction: 'consider-step-up-or-captcha',
    });
  }

  const resetRequestCount = countBySubjectKey(
    recentEvents,
    'VERIFICATION_CODE_REQUESTED',
    (event) => event.metadata?.purpose === 'RESET_PASSWORD',
  );
  if (resetRequestCount >= RESET_REQUEST_SPIKE_THRESHOLD) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.RESET_REQUEST_SPIKE,
      dimension: 'subject',
      count: resetRequestCount,
      recommendedAction: 'review-reset-abuse-and-delivery-health',
    });
  }

  const mailFailureCount = recentEvents.filter(
    (event) => event.type === 'MAIL_SEND_FAILURE',
  ).length;
  if (mailFailureCount >= MAIL_FAILURE_SPIKE_THRESHOLD) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.MAIL_FAILURE_SPIKE,
      dimension: 'provider',
      count: mailFailureCount,
      recommendedAction: 'check-email-provider-and-alert-channel',
    });
  }

  if (
    typeof input.mailOutboxLagSeconds === 'number' &&
    typeof input.mailOutboxLagAlertSeconds === 'number' &&
    input.mailOutboxLagSeconds >= input.mailOutboxLagAlertSeconds
  ) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.MAIL_OUTBOX_LAG_HIGH,
      dimension: 'outbox',
      count: Math.floor(input.mailOutboxLagSeconds),
      recommendedAction: 'inspect-mail-outbox-dispatcher',
    });
  }

  return alerts;
}
