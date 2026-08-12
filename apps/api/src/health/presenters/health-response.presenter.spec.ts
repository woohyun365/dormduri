import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { HealthReadinessCheckResult } from '../checks/health-check.types.js';
import { createHealthBaseResponse, presentReadinessResponse } from './health-response.presenter.js';

const upDatabase = result('database', 'up', 'DATABASE_UP');
const downBootstrap = result('runtimeBootstrap', 'down', 'RUNTIME_BOOTSTRAP_UNAVAILABLE');

describe('health response presenter', () => {
  let uptimeSpy: MockInstance<() => number>;

  beforeEach(() => {
    uptimeSpy = vi.spyOn(process, 'uptime').mockReturnValue(42);
  });

  afterEach(() => uptimeSpy.mockRestore());

  it('liveness base response는 process metadata만 포함한다', () => {
    expect(createHealthBaseResponse(new Date('2026-06-02T03:00:00.000Z'))).toEqual({
      status: 'ok',
      timestamp: '2026-06-02T03:00:00.000Z',
      uptimeSeconds: 42,
    });
  });

  it('readiness success는 aggregate status와 빈 failure code만 반환한다', () => {
    expect(presentReadinessResponse([upDatabase])).toEqual({
      status: 'ok',
      failureCodes: [],
    });
  });

  it('readiness failure는 bounded code만 반환한다', () => {
    const response = presentReadinessResponse([upDatabase, downBootstrap]);

    expect(response).toEqual({
      status: 'unavailable',
      failureCodes: ['RUNTIME_BOOTSTRAP_UNAVAILABLE'],
    });
    expect(JSON.stringify(response)).not.toContain('elapsedMs');
    expect(JSON.stringify(response)).not.toContain('secretSource');
    expect(JSON.stringify(response)).not.toContain('checkedAt');
  });
});

function result(
  name: HealthReadinessCheckResult['name'],
  status: HealthReadinessCheckResult['status'],
  code: HealthReadinessCheckResult['code'],
): HealthReadinessCheckResult {
  return {
    name,
    status,
    code,
    checkedAt: '2026-06-02T03:00:00.000Z',
    elapsedMs: 1,
  };
}
