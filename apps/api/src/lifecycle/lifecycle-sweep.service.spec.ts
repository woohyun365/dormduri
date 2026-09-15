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
import type { LifecycleSweepTaskPort } from './lifecycle-sweep-task.port.js';
import { Logger } from '@nestjs/common';

function createScheduledFixture(sweepEnabled = true) {
  const prisma = { getDatabaseNow: vi.fn().mockResolvedValue(new Date('2026-06-01T00:00:00Z')) };
  const run = vi.fn<LifecycleSweepTaskPort<'participantBackfill'>['run']>().mockResolvedValue([]);
  const boundarySchedule = {
    buildBoundaryJobs: vi
      .fn()
      .mockResolvedValue([
        { name: `${BOUNDARY_JOB_PREFIX}:season-1:matching-start`, runAt: new Date('2099-01-01') },
      ]),
  };
  const cronJobs = new Map<string, (typeof mockCronJobs)[number]>();
  const intervals = new Map<string, ReturnType<typeof setInterval>>();
  const registry = {
    getCronJobs: () => cronJobs,
    doesExist: (kind: string, name: string) =>
      kind === 'interval' ? intervals.has(name) : cronJobs.has(name),
    addCronJob: (name: string, job: (typeof mockCronJobs)[number]) => cronJobs.set(name, job),
    deleteCronJob: (name: string) => cronJobs.delete(name),
    addInterval: (name: string, interval: ReturnType<typeof setInterval>) =>
      intervals.set(name, interval),
    deleteInterval: (name: string) => {
      clearInterval(intervals.get(name));
      intervals.delete(name);
    },
  };
  const observability = {
    emitSweep: vi.fn().mockResolvedValue(undefined),
    emitSweepFailure: vi.fn(),
  };
  const service = new LifecycleSweepService(
    prisma as never,
    {} as never,
    [{ name: 'participantBackfill', order: 1, run }],
    boundarySchedule,
    registry as never,
    observability,
    { sweepEnabled, sweepIntervalMs: 1_000 },
  );
  function boundaryTick() {
    const job = cronJobs.values().next().value;
    if (!job) throw new Error('registered boundary job required');
    return job.onTick();
  }
  return {
    service,
    prisma,
    run,
    boundarySchedule,
    cronJobs,
    intervals,
    observability,
    boundaryTick,
    registry,
  };
}

describe('LifecycleSweepService', () => {
  beforeEach(() => {
    mockCronJobs.length = 0;
    vi.clearAllMocks();
  });

  it.each(
    (['refresh', 'bootstrap', 'periodic'] as const).flatMap((entry) =>
      (['clock', 'schedule'] as const).flatMap((point) =>
        (['resolve', 'reject'] as const).map((outcome) => ({ entry, point, outcome })),
      ),
    ),
  )(
    '$entry / pending $point / $outcome: destroy 이후 timer를 생성하지 않는다',
    async ({ entry, point, outcome }) => {
      vi.useFakeTimers();
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const f = createScheduledFixture();
      const externalInterval = setInterval(() => undefined, 60_000);
      const externalCron = {
        runAt: new Date('2099-01-01'),
        onTick: () => Promise.resolve(),
        start: vi.fn(),
      };
      f.intervals.set('external-interval', externalInterval);
      f.cronJobs.set('external-cron', externalCron);
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const error = new Error('pending lookup rejected');
      let settled: Promise<unknown> | undefined;
      try {
        if (entry === 'periodic') await f.service.onApplicationBootstrap();
        const constructed = mockCronJobs.length;
        const addCron = vi.spyOn(f.registry, 'addCronJob');
        const addInterval = vi.spyOn(f.registry, 'addInterval');
        const delayed = async () => {
          await pending;
          if (outcome === 'reject') throw error;
        };
        if (point === 'clock') {
          f.prisma.getDatabaseNow.mockImplementationOnce(async () => {
            await delayed();
            return new Date('2026-06-01');
          });
        } else {
          f.boundarySchedule.buildBoundaryJobs.mockImplementationOnce(async () => {
            await delayed();
            return [{ name: `${BOUNDARY_JOB_PREFIX}:late`, runAt: new Date('2099-01-01') }];
          });
        }
        const work =
          entry === 'refresh'
            ? f.service.refreshBoundarySchedules()
            : entry === 'bootstrap'
              ? f.service.onApplicationBootstrap()
              : vi.advanceTimersByTimeAsync(1_000);
        settled = work.then(
          () => null,
          (reason: unknown) => reason,
        );
        await vi.advanceTimersByTimeAsync(0);
        f.service.onModuleDestroy();
        f.service.onModuleDestroy();
        addCron.mockClear();
        addInterval.mockClear();
        release();
        expect(await settled).toBe(outcome === 'reject' && entry !== 'periodic' ? error : null);
        await vi.advanceTimersByTimeAsync(0);

        expect(mockCronJobs).toHaveLength(constructed);
        expect(addCron).not.toHaveBeenCalled();
        expect(addInterval).not.toHaveBeenCalled();
        expect([...f.cronJobs.keys()]).toEqual(['external-cron']);
        expect(f.cronJobs.get('external-cron')).toBe(externalCron);
        expect([...f.intervals.keys()]).toEqual(['external-interval']);
        expect(f.intervals.get('external-interval')).toBe(externalInterval);
        expect(vi.getTimerCount()).toBe(1);
        expect(f.observability.emitSweepFailure).toHaveBeenCalledTimes(
          entry === 'periodic' && outcome === 'reject' ? 1 : 0,
        );
        if (entry === 'periodic') {
          // A sweep already admitted before destroy is not cancelled by the timer gate.
          expect(f.run).toHaveBeenCalledTimes(outcome === 'resolve' ? 2 : 1);
        }
      } finally {
        release();
        await settled;
        await vi.advanceTimersByTimeAsync(0);
        f.service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        log.mockRestore();
      }
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'pending boundary task %s 뒤에도 종료 후 cron을 잠깐이라도 start하지 않는다',
    async (outcome) => {
      vi.useFakeTimers();
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const f = createScheduledFixture();
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let work: Promise<void> | undefined;
      try {
        await f.service.onApplicationBootstrap();
        const constructed = mockCronJobs.length;
        const addCron = vi.spyOn(f.registry, 'addCronJob');
        f.run.mockImplementationOnce(async () => {
          await pending;
          if (outcome === 'reject') throw new Error('task failed');
          return [];
        });
        work = f.boundaryTick();
        await vi.advanceTimersByTimeAsync(0);
        expect(f.run).toHaveBeenCalledTimes(2);
        f.service.onModuleDestroy();
        release();
        await work;
        // The callback's finally can delete a late job again: registry-empty alone is insufficient.
        expect(mockCronJobs).toHaveLength(constructed);
        expect(addCron).not.toHaveBeenCalled();
        expect(f.cronJobs.size).toBe(0);
        expect(f.observability.emitSweepFailure).toHaveBeenCalledTimes(
          outcome === 'reject' ? 1 : 0,
        );
      } finally {
        release();
        await Promise.allSettled([work]);
        f.service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        log.mockRestore();
      }
    },
  );

  it('destroy 뒤 bootstrap/refresh/기존 callback은 재등록하지 않고 manual runner 의미는 유지한다', async () => {
    vi.useFakeTimers();
    const f = createScheduledFixture();
    try {
      await f.service.onApplicationBootstrap();
      const callback = f.cronJobs.values().next().value?.onTick;
      expect(callback).toBeDefined();
      const constructed = mockCronJobs.length;
      f.service.onModuleDestroy();
      f.service.onModuleDestroy();
      await f.service.onApplicationBootstrap();
      await f.service.refreshBoundarySchedules();
      await callback?.();
      expect(mockCronJobs).toHaveLength(constructed);
      expect(f.cronJobs.size).toBe(0);
      expect(f.intervals.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(f.run).toHaveBeenCalledOnce();
      await f.service.runSweep();
      await f.service.runPeriodicSweep();
      await f.service.runBoundarySweep();
      expect(f.run).toHaveBeenCalledTimes(4);
      const error = new Error('manual failure');
      f.run.mockRejectedValueOnce(error);
      await expect(f.service.runSweep()).rejects.toBe(error);
    } finally {
      f.service.onModuleDestroy();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([true, false])(
    'bootstrap enabled=%s인 schedule만 실행하고 destroy는 현재 timer를 제거한다',
    async (enabled) => {
      vi.useFakeTimers();
      const { service, run, boundarySchedule, cronJobs, intervals } =
        createScheduledFixture(enabled);
      try {
        await service.onApplicationBootstrap();
        expect(intervals.size).toBe(enabled ? 1 : 0);
        expect(cronJobs.size).toBe(enabled ? 1 : 0);
        expect(vi.getTimerCount()).toBe(enabled ? 1 : 0);
        expect(run).toHaveBeenCalledTimes(enabled ? 1 : 0);
        expect(boundarySchedule.buildBoundaryJobs).toHaveBeenCalledTimes(enabled ? 2 : 0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(run).toHaveBeenCalledTimes(enabled ? 2 : 0);
        service.onModuleDestroy();
        expect(intervals.size).toBe(0);
        expect(cronJobs.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(run).toHaveBeenCalledTimes(enabled ? 2 : 0);
        expect(boundarySchedule.buildBoundaryJobs).toHaveBeenCalledTimes(enabled ? 3 : 0);
      } finally {
        service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );

  it.each(['periodic', 'boundary'] as const)(
    '%s task가 pending이면 반대 scheduled entry는 task를 중복 실행하지 않는다',
    async (firstMode) => {
      vi.useFakeTimers();
      const { service, run, observability, boundaryTick } = createScheduledFixture();
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let boundaryWork: Promise<void> | undefined;
      try {
        await service.onApplicationBootstrap();
        run.mockClear().mockImplementationOnce(async () => {
          await pending;
          return [];
        });
        observability.emitSweep.mockClear();
        if (firstMode === 'periodic') await vi.advanceTimersByTimeAsync(1_000);
        else {
          boundaryWork = boundaryTick();
          await vi.advanceTimersByTimeAsync(0);
        }
        expect(run).toHaveBeenCalledOnce();
        expect(observability.emitSweep).not.toHaveBeenCalled();

        if (firstMode === 'periodic') {
          boundaryWork = boundaryTick();
          await boundaryWork;
        } else await vi.advanceTimersByTimeAsync(1_000);
        expect(run).toHaveBeenCalledOnce();
        // Boundary post-tick refresh is outside the running guard; only task exclusion is asserted.
        release();
        await boundaryWork;
        await vi.advanceTimersByTimeAsync(0);
        expect(observability.emitSweep).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(run).toHaveBeenCalledTimes(2);
        expect(observability.emitSweep).toHaveBeenCalledTimes(2);
        expect(observability.emitSweepFailure).not.toHaveBeenCalled();
      } finally {
        release();
        await Promise.allSettled([boundaryWork]);
        await vi.advanceTimersByTimeAsync(0);
        service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    ['periodic', 'clock'],
    ['periodic', 'refresh'],
    ['periodic', 'task'],
    ['boundary', 'task'],
  ] as const)(
    '%s의 %s 실패 후 다음 scheduled tick은 다시 sweep한다',
    async (mode, failurePoint) => {
      vi.useFakeTimers();
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { service, prisma, run, boundarySchedule, observability, boundaryTick } =
        createScheduledFixture();
      const error = new Error(`${failurePoint} unavailable`);
      try {
        await service.onApplicationBootstrap();
        run.mockClear();
        observability.emitSweep.mockClear();
        if (failurePoint === 'clock') prisma.getDatabaseNow.mockRejectedValueOnce(error);
        else if (failurePoint === 'refresh')
          boundarySchedule.buildBoundaryJobs.mockRejectedValueOnce(error);
        else run.mockRejectedValueOnce(error);
        if (mode === 'periodic') await vi.advanceTimersByTimeAsync(1_000);
        else await boundaryTick();

        expect(observability.emitSweepFailure).toHaveBeenCalledExactlyOnceWith({ mode, error });
        expect(observability.emitSweep).not.toHaveBeenCalled();
        expect(run).toHaveBeenCalledTimes(failurePoint === 'task' ? 1 : 0);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(run).toHaveBeenCalledTimes(failurePoint === 'task' ? 2 : 1);
        expect(observability.emitSweep).toHaveBeenCalledOnce();
        expect(observability.emitSweepFailure).toHaveBeenCalledOnce();
      } finally {
        service.onModuleDestroy();
        vi.clearAllTimers();
        vi.useRealTimers();
        log.mockRestore();
      }
    },
  );

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
