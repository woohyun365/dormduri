export type HealthReadinessCheckName =
  | 'database'
  | 'runtimeConfig'
  | 'secretSource'
  | 'migration'
  | 'emailProvider';

export type HealthReadinessCheckStatus = 'up' | 'down';

export type HealthReadinessCheckCode =
  | 'DATABASE_UP'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_TIMEOUT'
  | 'RUNTIME_CONFIG_VALID'
  | 'RUNTIME_CONFIG_INVALID'
  | 'SECRET_SOURCE_VALID'
  | 'SECRET_SOURCE_INVALID'
  | 'MIGRATION_BASELINE_UP'
  | 'MIGRATION_BASELINE_UNAVAILABLE'
  | 'MIGRATION_BASELINE_FAILED'
  | 'MIGRATION_BASELINE_INCOMPLETE'
  | 'MIGRATION_BASELINE_TIMEOUT'
  | 'EMAIL_PROVIDER_READY'
  | 'EMAIL_PROVIDER_INVALID';

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
