import { describe, expect, it, vi } from 'vitest';
import type { DomainMetricsPort } from '../platform/observability/metrics/domain-metrics.port.js';
import {
  BackgroundJobMetricsService,
  runBackgroundJobTick,
} from './background-job-metrics.service.js';

function createMetrics() {
  const port = {
    incrementCounter: vi.fn(),
    setGauge: vi.fn(),
    observeHistogram: vi.fn(),
  } satisfies DomainMetricsPort;
  return { port, service: new BackgroundJobMetricsService(port) };
}

describe('BackgroundJobMetricsService', () => {
  it('성공한 tick은 job label의 마지막 성공 시각을 초 단위로 기록한다', async () => {
    const { port, service } = createMetrics();
    vi.useFakeTimers({ now: new Date('2026-11-07T00:00:05.900Z') });
    try {
      await runBackgroundJobTick(service, 'lifecycle_sweep', () => Promise.resolve('succeeded'));
    } finally {
      vi.useRealTimers();
    }

    expect(port.setGauge).toHaveBeenCalledExactlyOnceWith({
      name: 'api_background_job_last_success_timestamp_seconds',
      labels: { job: 'lifecycle_sweep' },
      value: Date.parse('2026-11-07T00:00:05.000Z') / 1_000,
    });
    expect(port.incrementCounter).not.toHaveBeenCalled();
  });

  it('실패한 tick은 실패 수를 하나 올리고 오류를 호출부 log로 다시 던진다', async () => {
    const { port, service } = createMetrics();
    const failure = new Error('dispatch failed');

    await expect(
      runBackgroundJobTick(service, 'auth_mail_dispatcher', () => Promise.reject(failure)),
    ).rejects.toBe(failure);

    expect(port.incrementCounter).toHaveBeenCalledExactlyOnceWith({
      name: 'api_background_job_failures_total',
      labels: { job: 'auth_mail_dispatcher' },
    });
    expect(port.setGauge).not.toHaveBeenCalled();
  });

  it('건너뛴 tick은 아무것도 기록하지 않고 metrics 없이도 tick을 실행한다', async () => {
    const { port, service } = createMetrics();
    const tick = vi.fn(() => Promise.resolve('skipped' as const));

    await runBackgroundJobTick(service, 'notification_dispatcher', tick);
    await runBackgroundJobTick(undefined, 'chat_realtime_dispatcher', tick);

    expect(tick).toHaveBeenCalledTimes(2);
    expect(port.setGauge).not.toHaveBeenCalled();
    expect(port.incrementCounter).not.toHaveBeenCalled();
  });

  it('metrics bridge가 거부해도 작업 결과에 영향을 주지 않는다', async () => {
    const { port, service } = createMetrics();
    port.setGauge.mockImplementation(() => {
      throw new Error('registry rejected');
    });

    await expect(
      runBackgroundJobTick(service, 'chat_realtime_dispatcher', () => Promise.resolve('succeeded')),
    ).resolves.toBeUndefined();
  });
});
