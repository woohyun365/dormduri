import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
const mockCronJobs = vi.hoisted(
  (): Array<{
    runAt: Date;
    onTick: () => Promise<void>;
    start: Mock;
  }> => [],
);

vi.mock('cron', () => ({
  CronJob: vi.fn(function CronJob(runAt: Date, onTick: () => Promise<void>) {
    const job = { runAt, onTick, start: vi.fn() };
    mockCronJobs.push(job);
    return job;
  }),
}));

import { BOUNDARY_JOB_PREFIX } from './lifecycle-boundary-schedule.port.js';
import { LifecycleSweepService } from './lifecycle-sweep.service.js';

describe('LifecycleSweepService', () => {
  beforeEach(() => {
    mockCronJobs.length = 0;
    vi.clearAllMocks();
  });

  it('refreshes only lifecycle boundary cron jobs through the boundary schedule port', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const boundarySchedule = {
      buildBoundaryJobs: vi.fn().mockResolvedValue([
        {
          name: `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`,
          runAt: new Date('2099-01-01T00:00:00.000Z'),
        },
      ]),
    };
    const cronJobs = new Map<string, unknown>([
      [`${BOUNDARY_JOB_PREFIX}:season-old:season-end-next-day`, {}],
      ['external-job', {}],
    ]);
    const schedulerRegistry = {
      getCronJobs: vi.fn(() => cronJobs),
      deleteCronJob: vi.fn((name: string) => cronJobs.delete(name)),
      addCronJob: vi.fn((name: string, job: unknown) => cronJobs.set(name, job)),
      doesExist: vi.fn().mockReturnValue(false),
      addInterval: vi.fn(),
      deleteInterval: vi.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: vi.fn().mockResolvedValue(now) } as never,
      {} as never,
      [],
      boundarySchedule,
      schedulerRegistry as never,
      { emitSweep: vi.fn(), emitSweepFailure: vi.fn() },
      { sweepEnabled: true, sweepIntervalMs: 1_000 },
    );

    await service.refreshBoundarySchedules(now);

    expect(boundarySchedule.buildBoundaryJobs).toHaveBeenCalledWith(now);
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
      `${BOUNDARY_JOB_PREFIX}:season-old:season-end-next-day`,
    );
    expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith('external-job');
    expect(mockCronJobs).toHaveLength(1);
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`,
      mockCronJobs[0],
    );
    expect(mockCronJobs[0]?.start).toHaveBeenCalledTimes(1);
  });

  it('does not build boundary jobs when lifecycle sweep is disabled', async () => {
    const boundarySchedule = { buildBoundaryJobs: vi.fn() };
    const schedulerRegistry = {
      getCronJobs: vi.fn(() => new Map()),
      deleteCronJob: vi.fn(),
      addCronJob: vi.fn(),
      doesExist: vi.fn().mockReturnValue(false),
      addInterval: vi.fn(),
      deleteInterval: vi.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: vi.fn() } as never,
      {} as never,
      [],
      boundarySchedule,
      schedulerRegistry as never,
      { emitSweep: vi.fn(), emitSweepFailure: vi.fn() },
      { sweepEnabled: false, sweepIntervalMs: 1_000 },
    );

    await service.refreshBoundarySchedules(new Date('2026-06-01T00:00:00.000Z'));

    expect(boundarySchedule.buildBoundaryJobs).not.toHaveBeenCalled();
    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
  });

  it('cleans up the periodic interval and lifecycle boundary cron jobs on module destroy', () => {
    const cronJobs = new Map<string, unknown>([
      [`${BOUNDARY_JOB_PREFIX}:season-1:matching-start`, {}],
      ['external-job', {}],
    ]);
    const schedulerRegistry = {
      getCronJobs: vi.fn(() => cronJobs),
      deleteCronJob: vi.fn((name: string) => cronJobs.delete(name)),
      doesExist: vi.fn(
        (kind: string, name: string) => kind === 'interval' && name === 'lifecycle-periodic-sweep',
      ),
      deleteInterval: vi.fn(),
      addCronJob: vi.fn(),
      addInterval: vi.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: vi.fn() } as never,
      {} as never,
      [],
      { buildBoundaryJobs: vi.fn() },
      schedulerRegistry as never,
      { emitSweep: vi.fn(), emitSweepFailure: vi.fn() },
      { sweepEnabled: true, sweepIntervalMs: 1_000 },
    );

    service.onModuleDestroy();

    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('lifecycle-periodic-sweep');
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
      `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`,
    );
    expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith('external-job');
  });
});
