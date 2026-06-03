import type { AuthSecurityEventType } from '../auth-security-event.types.js';

export const AUTH_SECURITY_ALERT_KINDS = {
  LOGIN_FAILURE_SPIKE: 'login-failure-spike',
  RESET_REQUEST_SPIKE: 'reset-request-spike',
  MAIL_FAILURE_SPIKE: 'mail-failure-spike',
} as const;

const WINDOW_MS = 10 * 60 * 1000;
const LOGIN_FAILURE_SPIKE_THRESHOLD = 5;
const RESET_REQUEST_SPIKE_THRESHOLD = 6;
const MAIL_FAILURE_SPIKE_THRESHOLD = 3;

export interface AuthSecurityAlertEvent {
  type: AuthSecurityEventType;
  emailHash?: string | null;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
}

export interface AuthSecurityAlert {
  kind: (typeof AUTH_SECURITY_ALERT_KINDS)[keyof typeof AUTH_SECURITY_ALERT_KINDS];
  dimension: 'email' | 'provider';
  count: number;
  recommendedAction:
    | 'consider-step-up-or-captcha'
    | 'review-reset-abuse-and-delivery-health'
    | 'check-email-provider-and-alert-channel';
}

function isWithinWindow(event: AuthSecurityAlertEvent, now: Date) {
  const ageMs = now.getTime() - event.createdAt.getTime();
  return ageMs >= 0 && ageMs <= WINDOW_MS;
}

function countByEmailHash(
  events: readonly AuthSecurityAlertEvent[],
  type: AuthSecurityEventType,
  predicate: (event: AuthSecurityAlertEvent) => boolean = () => true,
) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.type !== type || !event.emailHash || !predicate(event)) {
      continue;
    }
    counts.set(event.emailHash, (counts.get(event.emailHash) ?? 0) + 1);
  }

  return [...counts.values()].sort((left, right) => right - left)[0] ?? 0;
}

export function evaluateAuthSecurityEventAlerts(
  events: readonly AuthSecurityAlertEvent[],
  now: Date = new Date(),
): AuthSecurityAlert[] {
  const recentEvents = events.filter((event) => isWithinWindow(event, now));
  const alerts: AuthSecurityAlert[] = [];

  const loginFailureCount = countByEmailHash(recentEvents, 'LOGIN_FAILURE');
  if (loginFailureCount >= LOGIN_FAILURE_SPIKE_THRESHOLD) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.LOGIN_FAILURE_SPIKE,
      dimension: 'email',
      count: loginFailureCount,
      recommendedAction: 'consider-step-up-or-captcha',
    });
  }

  const resetRequestCount = countByEmailHash(
    recentEvents,
    'VERIFICATION_CODE_REQUESTED',
    (event) => event.metadata?.purpose === 'RESET_PASSWORD',
  );
  if (resetRequestCount >= RESET_REQUEST_SPIKE_THRESHOLD) {
    alerts.push({
      kind: AUTH_SECURITY_ALERT_KINDS.RESET_REQUEST_SPIKE,
      dimension: 'email',
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

  return alerts;
}
