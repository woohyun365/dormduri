export type HealthReadinessCheckName = 'database' | 'runtimeBootstrap';

export type HealthReadinessCheckStatus = 'up' | 'down';

export type HealthReadinessCheckCode =
  | 'DATABASE_UP'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_TIMEOUT'
  | 'MIGRATION_BASELINE_UNAVAILABLE'
  | 'MIGRATION_BASELINE_FAILED'
  | 'MIGRATION_BASELINE_INCOMPLETE'
  | 'RUNTIME_BOOTSTRAP_PREPARED'
  | 'RUNTIME_BOOTSTRAP_UNAVAILABLE';

export interface HealthReadinessCheckResult {
  readonly name: HealthReadinessCheckName;
  readonly status: HealthReadinessCheckStatus;
  readonly code: HealthReadinessCheckCode;
  readonly checkedAt: string;
  readonly elapsedMs: number;
}

export interface HealthReadinessCheck {
  readonly name: HealthReadinessCheckName;
  check(): Promise<HealthReadinessCheckResult>;
}

export const DEFAULT_HEALTH_READINESS_TIMEOUT_MS = 1_000;
