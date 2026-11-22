import { collectDefaultMetrics, Counter, Gauge, Registry } from '@prometheus-io/client';

/**
 * Security events the alert rules read (OA-R2, OA-R5, OA-R9). Labels are fixed values; no account, email or
 * code ever becomes a label.
 */
export const SECURITY_EVENTS = [
  'account_locked',
  'recovery_login',
  'role_granted',
  'role_revoked',
  'self_approval',
  'bootstrap_owner_used',
  'audit_write_failed',
] as const;
export type SecurityEvent = (typeof SECURITY_EVENTS)[number];

export const RETENTION_STEPS = [
  'audit_events',
  'role_assignments',
  'approval_requests',
  'account_anonymization',
  'sessions',
  'webauthn_challenges',
  'invitations',
] as const;
export type RetentionStep = (typeof RETENTION_STEPS)[number];
/** Where a cleanup run can stop: `start` is the database clock read before the first step. */
export const RETENTION_FAILURE_POINTS = ['start', ...RETENTION_STEPS] as const;
export type RetentionFailurePoint = (typeof RETENTION_FAILURE_POINTS)[number];

export class BackofficeMetrics {
  readonly registry = new Registry();
  private readonly securityEvents: Counter<'event'>;
  private readonly retentionRows: Counter<'step'>;
  private readonly retentionFailures: Counter<'step'>;
  private readonly retentionLastSuccess: Gauge;
  private readonly retentionLastRun: Gauge;

  constructor(env: string) {
    this.registry.setDefaultLabels({ service: 'backoffice-api', env });
    collectDefaultMetrics({ register: this.registry });
    this.securityEvents = new Counter({
      name: 'backoffice_security_events_total',
      help: 'Backoffice security events by kind (account lock, recovery login, role change, self approval, bootstrap, audit write failure).',
      labelNames: ['event'],
      registers: [this.registry],
    });
    this.retentionRows = new Counter({
      name: 'backoffice_retention_rows_total',
      help: 'Rows the backoffice records cleanup job deleted or anonymized, by step.',
      labelNames: ['step'],
      registers: [this.registry],
    });
    this.retentionFailures = new Counter({
      name: 'backoffice_retention_failures_total',
      help: 'Failed runs of the backoffice records cleanup job, by the step that failed (start: the database clock read).',
      labelNames: ['step'],
      registers: [this.registry],
    });
    this.retentionLastSuccess = new Gauge({
      name: 'backoffice_retention_last_success_timestamp_seconds',
      help: 'Unix time of the last cleanup run that finished every step.',
      registers: [this.registry],
    });
    this.retentionLastRun = new Gauge({
      name: 'backoffice_retention_last_run_timestamp_seconds',
      help: 'Unix time of the last cleanup run, successful or not.',
      registers: [this.registry],
    });
    for (const event of SECURITY_EVENTS) {
      this.securityEvents.inc({ event }, 0);
    }
    for (const step of RETENTION_STEPS) {
      this.retentionRows.inc({ step }, 0);
    }
    for (const step of RETENTION_FAILURE_POINTS) {
      this.retentionFailures.inc({ step }, 0);
    }
  }

  securityEvent(event: SecurityEvent): void {
    this.securityEvents.inc({ event });
  }

  retentionProcessed(step: RetentionStep, rows: number): void {
    this.retentionRows.inc({ step }, rows);
  }

  /** `at` is the run's database time; a run that failed to read it leaves the last-run time. */
  retentionFailed(step: RetentionFailurePoint, at: Date | null): void {
    this.retentionFailures.inc({ step });
    if (at) {
      this.retentionLastRun.set(at.getTime() / 1_000);
    }
  }

  retentionSucceeded(at: Date): void {
    this.retentionLastSuccess.set(at.getTime() / 1_000);
    this.retentionLastRun.set(at.getTime() / 1_000);
  }

  contentType(): string {
    return this.registry.contentType;
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
