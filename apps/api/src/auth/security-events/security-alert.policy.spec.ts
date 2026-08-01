import { describe, expect, it } from 'vitest';
import {
  AUTH_SECURITY_ALERT_KINDS,
  evaluateAuthSecurityEventAlerts,
} from './security-alert.policy.js';

describe('auth security alert policy', () => {
  it('동일 subject dimension의 login failure spike를 step-up/CAPTCHA 후보 trigger로 계산한다', () => {
    const events = Array.from({ length: 5 }, (_, index) => ({
      type: 'LOGIN_FAILURE' as const,
      subjectKey: 'v1:subject-key-1',
      createdAt: new Date(`2026-06-03T00:0${index}:00.000Z`),
    }));

    expect(
      evaluateAuthSecurityEventAlerts(events, new Date('2026-06-03T00:05:00.000Z')),
    ).toContainEqual(
      expect.objectContaining({
        kind: AUTH_SECURITY_ALERT_KINDS.LOGIN_FAILURE_SPIKE,
        dimension: 'subject',
        recommendedAction: 'consider-step-up-or-captcha',
      }),
    );
  });

  it('reset request와 mail failure spike는 provider/alert channel 확정 전에도 별도 trigger로 남긴다', () => {
    const now = new Date('2026-06-03T00:10:00.000Z');
    const events = [
      ...Array.from({ length: 6 }, (_, index) => ({
        type: 'VERIFICATION_CODE_REQUESTED' as const,
        subjectKey: 'v1:subject-key-2',
        createdAt: new Date(now.getTime() - index * 60_000),
        metadata: { purpose: 'RESET_PASSWORD' },
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        type: 'MAIL_SEND_FAILURE' as const,
        createdAt: new Date(now.getTime() - index * 60_000),
        metadata: { providerErrorCategory: 'throttled' },
      })),
    ];

    expect(evaluateAuthSecurityEventAlerts(events, now)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: AUTH_SECURITY_ALERT_KINDS.RESET_REQUEST_SPIKE,
          recommendedAction: 'review-reset-abuse-and-delivery-health',
        }),
        expect.objectContaining({
          kind: AUTH_SECURITY_ALERT_KINDS.MAIL_FAILURE_SPIKE,
          recommendedAction: 'check-email-provider-and-alert-channel',
        }),
      ]),
    );
  });

  it('pending mail outbox lag가 운영 threshold를 넘으면 별도 alert를 계산한다', () => {
    expect(
      evaluateAuthSecurityEventAlerts([], new Date('2026-06-03T00:10:00.000Z'), {
        mailOutboxLagSeconds: 61,
        mailOutboxLagAlertSeconds: 60,
      }),
    ).toContainEqual({
      kind: AUTH_SECURITY_ALERT_KINDS.MAIL_OUTBOX_LAG_HIGH,
      dimension: 'outbox',
      count: 61,
      recommendedAction: 'inspect-mail-outbox-dispatcher',
    });
  });
});
