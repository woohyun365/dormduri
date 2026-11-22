import { describe, expect, it, vi } from 'vitest';
import type { BackofficeRetentionPrisma } from '../../platform/database/backoffice-prisma.js';
import type { BackofficeLogger } from '../../platform/observability/backoffice-logger.js';
import { BackofficeMetrics } from '../../platform/observability/backoffice-metrics.js';
import {
  AdminRecordsRetention,
  RETENTION_STEP_ORDER,
  retentionCutoffs,
} from './admin-records-retention.js';

describe('backoffice records cleanup', () => {
  it('runs the steps in the README §5 order', () => {
    expect(RETENTION_STEP_ORDER.map((definition) => definition.step)).toEqual([
      'audit_events',
      'role_assignments',
      'approval_requests',
      'account_anonymization',
      'sessions',
      'webauthn_challenges',
      'invitations',
    ]);
  });

  it('cuts records at three calendar years and ended auth state at seven days', () => {
    const cutoffs = retentionCutoffs(new Date('2026-11-21T03:00:00.000Z'));
    expect(cutoffs.records.toISOString()).toBe('2023-11-21T03:00:00.000Z');
    expect(cutoffs.endedAuthState.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });

  it('stops at a failing step so later steps never run out of order, and records the failure', async () => {
    const calls: string[] = [];
    const steps = RETENTION_STEP_ORDER.map((definition) => ({
      step: definition.step,
      run: vi.fn(() => {
        calls.push(definition.step);
        if (definition.step === 'role_assignments') {
          return Promise.reject(new Error('permission denied'));
        }
        return Promise.resolve(0);
      }),
    }));
    const metrics = new BackofficeMetrics('test');
    const prisma = { databaseNow: () => Promise.resolve(new Date('2026-11-21T00:00:00.000Z')) };
    const logger = { event: vi.fn() } as unknown as BackofficeLogger;
    const result = await new AdminRecordsRetention(
      prisma as unknown as BackofficeRetentionPrisma,
      metrics,
      logger,
      steps,
    ).runOnce();
    expect(result).toEqual({
      ok: false,
      failedStep: 'role_assignments',
      processed: { audit_events: 0 },
    });
    expect(calls).toEqual(['audit_events', 'role_assignments']);
    expect(await metrics.render()).toMatch(
      /backoffice_retention_failures_total\{step="role_assignments"[^}]*\} 1/u,
    );
  });

  it('counts and logs a run that cannot read the database clock, and runs no step', async () => {
    const run = vi.fn(() => Promise.resolve(0));
    const metrics = new BackofficeMetrics('test');
    const event = vi.fn();
    const prisma = {
      databaseNow: () => Promise.reject(new Error('password authentication failed')),
    };
    const result = await new AdminRecordsRetention(
      prisma as unknown as BackofficeRetentionPrisma,
      metrics,
      { event } as unknown as BackofficeLogger,
      [{ step: 'audit_events', run }],
    ).runOnce();
    expect(result).toEqual({ ok: false, failedStep: 'start', processed: {} });
    expect(run).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith('error', 'backoffice_retention_step_failed', {
      step: 'start',
      errorName: 'Error',
    });
    expect(await metrics.render()).toMatch(
      /backoffice_retention_failures_total\{step="start"[^}]*\} 1/u,
    );
  });

  it('repeats a step in batches until a batch is short', async () => {
    const sizes = [2, 2, 1];
    const run = vi.fn(() => Promise.resolve(sizes.shift() ?? 0));
    const prisma = { databaseNow: () => Promise.resolve(new Date('2026-11-21T00:00:00.000Z')) };
    const result = await new AdminRecordsRetention(
      prisma as unknown as BackofficeRetentionPrisma,
      new BackofficeMetrics('test'),
      { event: vi.fn() } as unknown as BackofficeLogger,
      [{ step: 'audit_events', run }],
      2,
    ).runOnce();
    expect(run).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: true, processed: { audit_events: 5 } });
  });
});
