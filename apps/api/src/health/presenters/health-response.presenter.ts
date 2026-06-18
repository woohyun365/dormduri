import type {
  HealthReadinessCheckName,
  HealthReadinessCheckResult,
} from '../checks/health-check.types.js';

export interface HealthBaseResponse {
  readonly status: 'ok';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

export interface HealthReadinessResponse {
  readonly status: 'ok' | 'unavailable';
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly checks: Record<HealthReadinessCheckName, HealthReadinessCheckResult>;
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
  now = new Date(),
): HealthReadinessResponse {
  const checkMap = Object.fromEntries(checks.map((check) => [check.name, check])) as Record<
    HealthReadinessCheckName,
    HealthReadinessCheckResult
  >;

  return {
    ...createHealthBaseResponse(now),
    status: checks.every((check) => check.status === 'up') ? 'ok' : 'unavailable',
    checks: checkMap,
  };
}
