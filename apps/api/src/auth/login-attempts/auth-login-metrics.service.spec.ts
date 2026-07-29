import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../../platform/observability/metrics/domain-metrics.port.js';
import { AuthLoginMetricsService } from './auth-login-metrics.service.js';

describe('AuthLoginMetricsService', () => {
  it('login 결과와 throttle scope를 bounded label로 기록한다', () => {
    const domainMetrics = {
      incrementCounter: vi.fn(),
      setGauge: vi.fn(),
      observeHistogram: vi.fn(),
    } satisfies DomainMetricsPort;
    const metrics = new AuthLoginMetricsService(domainMetrics);

    metrics.recordAttempt('success');
    metrics.recordThrottle('ip_burst');

    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_login_attempts_total',
      labels: { outcome: 'success' },
    });
    expect(domainMetrics.incrementCounter).toHaveBeenCalledWith({
      name: 'api_auth_login_throttle_total',
      labels: { scope: 'ip_burst' },
    });
  });

  it('password verify in-flight와 duration을 real/dummy 외의 식별자 없이 기록한다', () => {
    const domainMetrics = {
      incrementCounter: vi.fn(),
      setGauge: vi.fn(),
      observeHistogram: vi.fn(),
    } satisfies DomainMetricsPort;
    const metrics = new AuthLoginMetricsService(domainMetrics);

    const complete = metrics.startPasswordVerify('dummy');
    complete();
    complete();

    expect(domainMetrics.setGauge).toHaveBeenNthCalledWith(1, {
      name: 'api_auth_login_password_verify_in_flight',
      labels: { target: 'dummy' },
      value: 1,
    });
    expect(domainMetrics.setGauge).toHaveBeenNthCalledWith(2, {
      name: 'api_auth_login_password_verify_in_flight',
      labels: { target: 'dummy' },
      value: 0,
    });
    expect(domainMetrics.observeHistogram).toHaveBeenCalledTimes(1);
    const histogramCalls = domainMetrics.observeHistogram.mock.calls as unknown as Array<
      [Parameters<DomainMetricsPort['observeHistogram']>[0]]
    >;
    const histogramCall = histogramCalls[0]?.[0];
    expect(histogramCall).toMatchObject({
      name: 'api_auth_login_password_verify_duration_seconds',
      labels: { target: 'dummy' },
    });
    expect(typeof histogramCall?.value).toBe('number');
  });
});
