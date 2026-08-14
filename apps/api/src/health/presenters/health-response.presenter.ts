import type {
  HealthReadinessCheckCode,
  HealthReadinessCheckResult,
} from '../checks/health-check.types.js';

export interface HealthBaseResponse {
  readonly status: 'ok';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

export interface HealthReadinessResponse {
  readonly status: 'ok' | 'unavailable';
  readonly failureCodes: readonly HealthReadinessCheckCode[];
}

export function createHealthBaseResponse(now = new Date()): HealthBaseResponse {
  return {
    status: 'ok',
    timestamp: now.toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

export function presentReadinessResponse(
  checks: readonly HealthReadinessCheckResult[],
): HealthReadinessResponse {
  const failureCodes = checks
    .filter((check) => check.status === 'down')
    .map((check) => check.code)
    .sort();

  return {
    status: failureCodes.length === 0 ? 'ok' : 'unavailable',
    failureCodes,
  };
}
