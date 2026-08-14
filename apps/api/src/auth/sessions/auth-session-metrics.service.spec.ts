import { describe, expect, it, vi } from 'vitest';
import { AuthSessionMetricsService } from './auth-session-metrics.service.js';

describe('AuthSessionMetricsService', () => {
  it.each(['renewed', 'required', 'reused', 'stale'] as const)(
    'renewal %s 결과를 bounded outcome으로 기록한다',
    (outcome) => {
      const incrementCounter = vi.fn();
      const metrics = new AuthSessionMetricsService({ incrementCounter } as never);

      metrics.recordRenewal(outcome);

      expect(incrementCounter).toHaveBeenCalledWith({
        name: 'api_auth_session_renewals_total',
        labels: { outcome },
      });
    },
  );

  it('metrics adapter가 없어도 session lifecycle을 방해하지 않는다', () => {
    const metrics = new AuthSessionMetricsService();

    expect(() => metrics.recordRenewal('renewed')).not.toThrow();
  });
});
