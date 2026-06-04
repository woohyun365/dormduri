const mockCronJobs: Array<{
  runAt: Date;
  onTick: () => Promise<void>;
  start: jest.Mock;
}> = [];

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation((runAt: Date, onTick: () => Promise<void>) => {
    const job = { runAt, onTick, start: jest.fn() };
    mockCronJobs.push(job);
    return job;
  }),
}));

import { BOUNDARY_JOB_PREFIX } from './lifecycle-boundary-schedule.port.js';
import { LifecycleSweepService } from './lifecycle-sweep.service.js';

describe('LifecycleSweepService', () => {
  beforeEach(() => {
    mockCronJobs.length = 0;
    jest.clearAllMocks();
  });

  it('refreshes only lifecycle boundary cron jobs through the boundary schedule port', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const boundarySchedule = {
      buildBoundaryJobs: jest.fn().mockResolvedValue([
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
      getCronJobs: jest.fn(() => cronJobs),
      deleteCronJob: jest.fn((name: string) => cronJobs.delete(name)),
      addCronJob: jest.fn((name: string, job: unknown) => cronJobs.set(name, job)),
      doesExist: jest.fn().mockReturnValue(false),
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: jest.fn().mockResolvedValue(now) } as never,
      {} as never,
      [],
      boundarySchedule as never,
      schedulerRegistry as never,
      { emitSweep: jest.fn(), emitSweepFailure: jest.fn() } as never,
      { sweepEnabled: true, sweepIntervalMs: 1_000 } as never,
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
    const boundarySchedule = { buildBoundaryJobs: jest.fn() };
    const schedulerRegistry = {
      getCronJobs: jest.fn(() => new Map()),
      deleteCronJob: jest.fn(),
      addCronJob: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      addInterval: jest.fn(),
      deleteInterval: jest.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: jest.fn() } as never,
      {} as never,
      [],
      boundarySchedule as never,
      schedulerRegistry as never,
      { emitSweep: jest.fn(), emitSweepFailure: jest.fn() } as never,
      { sweepEnabled: false, sweepIntervalMs: 1_000 } as never,
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
      getCronJobs: jest.fn(() => cronJobs),
      deleteCronJob: jest.fn((name: string) => cronJobs.delete(name)),
      doesExist: jest.fn(
        (kind: string, name: string) => kind === 'interval' && name === 'lifecycle-periodic-sweep',
      ),
      deleteInterval: jest.fn(),
      addCronJob: jest.fn(),
      addInterval: jest.fn(),
    };
    const service = new LifecycleSweepService(
      { getDatabaseNow: jest.fn() } as never,
      {} as never,
      [],
      { buildBoundaryJobs: jest.fn() } as never,
      schedulerRegistry as never,
      { emitSweep: jest.fn(), emitSweepFailure: jest.fn() } as never,
      { sweepEnabled: true, sweepIntervalMs: 1_000 } as never,
    );

    service.onModuleDestroy();

    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('lifecycle-periodic-sweep');
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
      `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`,
    );
    expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith('external-job');
  });
});
