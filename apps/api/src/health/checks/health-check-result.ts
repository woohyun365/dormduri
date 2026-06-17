import type {
  HealthReadinessCheckCode,
  HealthReadinessCheckName,
  HealthReadinessCheckResult,
  HealthReadinessCheckStatus,
} from './health-check.types.js';

export function createHealthCheckResult(input: {
  readonly name: HealthReadinessCheckName;
  readonly status: HealthReadinessCheckStatus;
  readonly code: HealthReadinessCheckCode;
  readonly startedAtMs: number;
  readonly checkedAt?: Date;
}): HealthReadinessCheckResult {
  const finishedAtMs = Date.now();

  return {
    name: input.name,
    status: input.status,
    code: input.code,
    checkedAt: (input.checkedAt ?? new Date(finishedAtMs)).toISOString(),
    elapsedMs: Math.max(0, finishedAtMs - input.startedAtMs),
  };
}
