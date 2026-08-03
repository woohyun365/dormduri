import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import {
  AuthFlowMetricsService,
  type AuthPasswordPolicyOperation,
} from './auth-flow-metrics.service.js';
import type { AuthPasswordPolicyRejectionReason } from '../credentials/password-policy/auth-password-structure.policy.js';

const PASSWORD_POLICY_OPERATIONS = [
  'signup',
  'reset_password',
  'change_password',
] as const satisfies readonly AuthPasswordPolicyOperation[];

const PASSWORD_POLICY_REJECTION_REASONS = [
  'required',
  'too_short',
  'too_long',
  'whitespace',
  'invalid_characters',
  'common',
  'contextual',
] as const satisfies readonly AuthPasswordPolicyRejectionReason[];

const PASSWORD_POLICY_METRIC_CASES = PASSWORD_POLICY_OPERATIONS.flatMap((operation) =>
  PASSWORD_POLICY_REJECTION_REASONS.map((reason) => [operation, reason] as const),
);

describe('AuthFlowMetricsService', () => {
  it('verification, credential transition, mail dispatch를 bounded label로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthFlowMetricsService(metrics);

    service.recordVerification('RESET_PASSWORD', 'request', 'accepted');
    service.recordCredentialTransition('reset_password', 'committed');
    service.recordSignupFinalAdmission('allowed');
    service.recordSignupPasswordHash('completed', 0.2);
    service.recordPasswordHashAdmission('login_verify', 'admitted');
    service.recordPasswordHashInFlight('login_verify', 2);
    service.recordPasswordHashOperation('login_verify', 'verify', 0.12);
    service.recordPasswordPolicyRejected('signup', 'invalid_characters');
    service.recordSensitiveMutation('change_password', 'audit_append_failed');
    service.recordMailDispatch('accepted', 12);

    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_verification_operations_total',
      labels: {
        operation: 'request',
        outcome: 'accepted',
        scope: 'reset_password',
      },
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_credential_transitions_total',
      labels: { operation: 'reset_password', outcome: 'committed' },
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_mail_dispatch_total',
      labels: { outcome: 'accepted' },
    });
    expect(metrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_mail_outbox_lag_seconds',
      value: 12,
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_signup_final_admission_total',
      labels: { outcome: 'allowed' },
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_auth_signup_password_hash_duration_seconds',
      labels: { outcome: 'completed' },
      value: 0.2,
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_sensitive_mutations_total',
      labels: { operation: 'change_password', outcome: 'audit_append_failed' },
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_admission_total',
      labels: { operation: 'login_verify', outcome: 'admitted' },
    });
    expect(metrics.setGauge).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_in_flight',
      labels: { operation: 'login_verify' },
      value: 2,
    });
    expect(metrics.observeHistogram).toHaveBeenCalledWith({
      name: 'api_auth_password_hash_duration_seconds',
      labels: { operation: 'login_verify', target: 'verify' },
      value: 0.12,
    });
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_password_policy_rejected_total',
      labels: { operation: 'signup', reason: 'invalid_characters' },
    });
  });

  it('metric adapter failure가 password policy product flow로 전파되지 않는다', () => {
    const metrics = makeMetrics();
    metrics.incrementCounter.mockImplementation(() => {
      throw new Error('metrics unavailable');
    });
    const service = new AuthFlowMetricsService(metrics);

    expect(() => service.recordPasswordPolicyRejected('reset_password', 'common')).not.toThrow();
  });

  it.each(PASSWORD_POLICY_METRIC_CASES)(
    'password policy rejection %s/%s을 bounded label로 한 번만 기록한다',
    (operation, reason) => {
      const metrics = makeMetrics();
      const service = new AuthFlowMetricsService(metrics);

      service.recordPasswordPolicyRejected(operation, reason);

      expect(metrics.incrementCounter).toHaveBeenCalledTimes(1);
      expect(metrics.incrementCounter).toHaveBeenCalledWith({
        name: 'api_auth_password_policy_rejected_total',
        labels: { operation, reason },
      });
    },
  );
});

function makeMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
