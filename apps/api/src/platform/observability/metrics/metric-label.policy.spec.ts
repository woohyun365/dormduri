import { describe, expect, it } from 'vitest';
import {
  MetricLabelPolicyError,
  assertDomainMetricLabelNames,
  assertNoForbiddenMetricLabelNames,
  normalizeDomainMetricLabelValue,
  normalizeExceptionMetricCode,
  normalizeMetricDomain,
  normalizeMetricMethod,
  normalizeMetricRoute,
  normalizeMetricStatusClass,
} from './metric-label.policy.js';

describe('metric label policy', () => {
  it('rejects high-cardinality or sensitive metric label names', () => {
    expect(() => assertNoForbiddenMetricLabelNames(['route', 'method'])).not.toThrow();
    expect(() => assertNoForbiddenMetricLabelNames(['route', 'userId'])).toThrow(
      MetricLabelPolicyError,
    );
    expect(() => assertNoForbiddenMetricLabelNames(['requestId', 'email'])).toThrow(
      /requestId, email/,
    );
  });

  it('normalizes request labels into bounded values', () => {
    expect(normalizeMetricMethod('post')).toBe('POST');
    expect(normalizeMetricMethod('GET /raw')).toBe('GETRAW');
    expect(normalizeMetricRoute('/api/users/:id')).toBe('/api/users/:id');
    expect(normalizeMetricRoute('/api/users/real-user-id?token=secret')).toBe('UNKNOWN_ROUTE');
    expect(normalizeMetricRoute('')).toBe('UNKNOWN_ROUTE');
    expect(normalizeMetricStatusClass(201)).toBe('2xx');
    expect(normalizeMetricStatusClass(302)).toBe('3xx');
    expect(normalizeMetricStatusClass(404)).toBe('4xx');
    expect(normalizeMetricStatusClass(503)).toBe('5xx');
  });

  it('normalizes exception labels without leaking raw payload-like values', () => {
    expect(normalizeExceptionMetricCode('auth code throttled')).toBe('AUTH_CODE_THROTTLED');
    expect(normalizeMetricDomain('Social Safety')).toBe('social_safety');
    expect(normalizeMetricDomain('')).toBe('platform');
  });

  it('keeps domain metric labels bounded and normalized', () => {
    expect(() => assertDomainMetricLabelNames(['domain', 'operation', 'outcome'])).not.toThrow();
    expect(() => assertDomainMetricLabelNames(['userId'])).toThrow(MetricLabelPolicyError);
    expect(() => assertDomainMetricLabelNames(['rawPath'])).toThrow(MetricLabelPolicyError);
    expect(() => assertDomainMetricLabelNames(['freeFormFilter'])).toThrow(
      /Unknown domain metric label names/,
    );
    expect(normalizeDomainMetricLabelValue('MATCH_SCORE')).toBe('match_score');
    expect(normalizeDomainMetricLabelValue('Manual Review / Retry')).toBe('manual_review_retry');
  });
});
