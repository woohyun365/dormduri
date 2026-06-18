import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createHealthBaseResponse, presentReadinessResponse } from './health-response.presenter.js';
import type { HealthReadinessCheckResult } from '../checks/health-check.types.js';

const upDatabase: HealthReadinessCheckResult = {
  name: 'database',
  status: 'up',
  code: 'DATABASE_UP',
  checkedAt: '2026-06-02T03:00:00.000Z',
  elapsedMs: 1,
};

const downRuntimeConfig: HealthReadinessCheckResult = {
  name: 'runtimeConfig',
  status: 'down',
  code: 'RUNTIME_CONFIG_INVALID',
  checkedAt: '2026-06-02T03:00:00.000Z',
  elapsedMs: 1,
};

describe('health response presenter', () => {
  let uptimeSpy: MockInstance<() => number>;

  beforeEach(() => {
    uptimeSpy = vi.spyOn(process, 'uptime').mockReturnValue(42);
  });

  afterEach(() => {
    uptimeSpy.mockRestore();
  });

  it('liveness base response는 process metadata만 포함한다', () => {
    expect(createHealthBaseResponse(new Date('2026-06-02T03:00:00.000Z'))).toEqual({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
    });
  });

  it('모든 check가 up이면 readiness status는 ok다', () => {
    expect(presentReadinessResponse([upDatabase], new Date('2026-06-02T03:00:00.000Z'))).toEqual({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
      checks: {
        database: upDatabase,
      },
    });
  });

  it('하나라도 down이면 readiness status는 unavailable이며 raw error를 포함하지 않는다', () => {
    const response = presentReadinessResponse(
      [upDatabase, downRuntimeConfig],
      new Date('2026-06-02T03:00:00.000Z'),
    );

    expect(response.status).toBe('unavailable');
    expect(JSON.stringify(response)).not.toContain('postgres://');
    expect(JSON.stringify(response)).not.toContain('stack');
  });
});
