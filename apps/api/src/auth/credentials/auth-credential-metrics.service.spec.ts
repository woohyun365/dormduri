import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import {
  AuthCredentialMetricsService,
  type AuthPasswordPolicyOperation,
} from './auth-credential-metrics.service.js';
import type { AuthPasswordPolicyRejectionReason } from './password-policy/auth-password-structure.policy.js';

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

describe('AuthCredentialMetricsService', () => {
  it('credential transition과 sensitive mutation을 bounded label로 기록한다', () => {
    const metrics = makeMetrics();
    const service = new AuthCredentialMetricsService(metrics);

    service.recordTransition('reset_password', 'committed');
    service.recordSensitiveMutation('change_password', 'audit_append_failed');

    expect(metrics.incrementCounter).toHaveBeenNthCalledWith(1, {
      name: 'api_auth_credential_transitions_total',
      labels: { operation: 'reset_password', outcome: 'committed' },
    });
    expect(metrics.incrementCounter).toHaveBeenNthCalledWith(2, {
      name: 'api_auth_sensitive_mutations_total',
      labels: { operation: 'change_password', outcome: 'audit_append_failed' },
    });
  });

  it.each(
    PASSWORD_POLICY_OPERATIONS.flatMap((operation) =>
      PASSWORD_POLICY_REJECTION_REASONS.map((reason) => [operation, reason] as const),
    ),
  )('password policy rejection %s/%s을 한 번만 기록한다', (operation, reason) => {
    const metrics = makeMetrics();
    const service = new AuthCredentialMetricsService(metrics);

    service.recordPasswordPolicyRejected(operation, reason);

    expect(metrics.incrementCounter).toHaveBeenCalledTimes(1);
    expect(metrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_password_policy_rejected_total',
      labels: { operation, reason },
    });
  });

  it('metric adapter failure를 credential flow로 전파하지 않는다', () => {
    const metrics = makeMetrics();
    metrics.incrementCounter.mockImplementation(() => {
      throw new Error('metrics unavailable');
    });
    const service = new AuthCredentialMetricsService(metrics);

    expect(() => service.recordPasswordPolicyRejected('reset_password', 'common')).not.toThrow();
  });
});

function makeMetrics() {
  return {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
}
