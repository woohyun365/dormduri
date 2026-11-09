import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  BackgroundJobMetricsService,
  drainBackgroundJob,
} from '../background-jobs/background-job-metrics.service.js';
import lifecycleConfig from './config/lifecycle.config.js';
import {
  BOUNDARY_JOB_PREFIX,
  type LifecycleBoundarySchedulePort,
} from './lifecycle-boundary-schedule.port.js';
import { createLifecycleSweepRunner } from './lifecycle-sweep-runner.js';
import {
  PrismaService,
  RetentionWorkerPrismaService,
} from '../platform/database/prisma.service.js';
import {
  RETENTION_OBSERVABILITY_PORT,
  type RetentionObservabilityPort,
} from '../retention/composition/retention.tokens.js';
import type { LifecycleSweepTaskPort } from './lifecycle-sweep-task.port.js';
import { LIFECYCLE_BOUNDARY_SCHEDULE, LIFECYCLE_SWEEP_TASKS } from './lifecycle-sweep.tokens.js';
import type { LifecycleSweepResult } from './lifecycle-sweep.types.js';

const PERIODIC_INTERVAL_NAME = 'lifecycle-periodic-sweep';
// Inside the compose stop_grace_period (30s), leaving time for the remaining shutdown hooks.
const SHUTDOWN_SWEEP_DRAIN_TIMEOUT_MS = 20_000;

export type { LifecycleSweepResult } from './lifecycle-sweep.types.js';

@Injectable()
export class LifecycleSweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleSweepService.name);
  private readonly runner;
  private running = false;
  private closing = false;
  private activeScheduledSweep: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionWorkerPrisma: RetentionWorkerPrismaService,
    @Inject(LIFECYCLE_SWEEP_TASKS)
    lifecycleSweepTasks: readonly LifecycleSweepTaskPort[],
    @Inject(LIFECYCLE_BOUNDARY_SCHEDULE)
    private readonly boundarySchedule: LifecycleBoundarySchedulePort,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(RETENTION_OBSERVABILITY_PORT)
    private readonly retentionObservability: RetentionObservabilityPort,
    @Inject(lifecycleConfig.KEY)
    private readonly lifecycleSettings: ConfigType<typeof lifecycleConfig>,
    @Optional()
    private readonly backgroundJobMetrics?: BackgroundJobMetricsService,
  ) {
    this.runner = createLifecycleSweepRunner({
      prisma: this.prisma,
      retentionPrisma: this.retentionWorkerPrisma,
      retentionObservability: this.retentionObservability,
      tasks: lifecycleSweepTasks,
      logger: this.logger,
    });
  }

  async onApplicationBootstrap() {
    if (this.closing || !this.lifecycleSettings.sweepEnabled) {
      return;
    }

    this.registerPeriodicInterval();
    await this.refreshBoundarySchedules();
    await this.runScheduledSweep('periodic');
  }

  async onModuleDestroy() {
    this.closing = true;
    if (this.schedulerRegistry.doesExist('interval', PERIODIC_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(PERIODIC_INTERVAL_NAME);
    }

    for (const jobName of this.schedulerRegistry.getCronJobs().keys()) {
      if (!jobName.startsWith(BOUNDARY_JOB_PREFIX)) {
        continue;
      }
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    await this.drainActiveScheduledSweep();
  }

  async runSweep(now?: Date): Promise<LifecycleSweepResult> {
    return this.runner.runSweep(now);
  }

  async runPeriodicSweep(now?: Date): Promise<LifecycleSweepResult> {
    return this.runner.runPeriodicSweep(now);
  }

  async runBoundarySweep(now?: Date): Promise<LifecycleSweepResult> {
    return this.runner.runBoundarySweep(now);
  }

  async refreshBoundarySchedules(now?: Date) {
    if (this.closing || !this.lifecycleSettings.sweepEnabled) {
      return;
    }

    const referenceNow = now ?? (await this.prisma.getDatabaseNow());
    if (this.closing) return;
    const desiredJobs = await this.boundarySchedule.buildBoundaryJobs(referenceNow);
    if (this.closing) return;

    for (const existingName of this.schedulerRegistry.getCronJobs().keys()) {
      if (!existingName.startsWith(BOUNDARY_JOB_PREFIX)) {
        continue;
      }

      this.schedulerRegistry.deleteCronJob(existingName);
    }

    for (const job of desiredJobs) {
      const cronJob = new CronJob(job.runAt, async () => {
        try {
          await this.runScheduledSweep('boundary');
          await this.refreshBoundarySchedules();
        } finally {
          if (this.schedulerRegistry.doesExist('cron', job.name)) {
            this.schedulerRegistry.deleteCronJob(job.name);
          }
        }
      });

      this.schedulerRegistry.addCronJob(job.name, cronJob);
      cronJob.start();
    }
  }

  private registerPeriodicInterval() {
    if (this.schedulerRegistry.doesExist('interval', PERIODIC_INTERVAL_NAME)) {
      return;
    }

    const interval = setInterval(() => {
      void this.runScheduledSweep('periodic');
    }, this.lifecycleSettings.sweepIntervalMs);
    interval.unref?.();
    this.schedulerRegistry.addInterval(PERIODIC_INTERVAL_NAME, interval);
  }

  private runScheduledSweep(mode: 'periodic' | 'boundary'): Promise<void> {
    if (this.closing || this.running) {
      return Promise.resolve();
    }

    this.running = true;
    const sweep = this.executeScheduledSweep(mode).finally(() => {
      this.running = false;
      this.activeScheduledSweep = null;
    });
    this.activeScheduledSweep = sweep;
    return sweep;
  }

  private async drainActiveScheduledSweep() {
    const sweep = this.activeScheduledSweep;
    if (sweep && !(await drainBackgroundJob(sweep, SHUTDOWN_SWEEP_DRAIN_TIMEOUT_MS))) {
      this.logger.warn(
        `Lifecycle sweep still running after ${SHUTDOWN_SWEEP_DRAIN_TIMEOUT_MS}ms shutdown wait.`,
      );
    }
  }

  private async executeScheduledSweep(mode: 'periodic' | 'boundary') {
    try {
      if (mode === 'boundary') {
        await this.runBoundarySweep();
      } else {
        await this.refreshBoundarySchedules();
        await this.runPeriodicSweep();
      }
      this.backgroundJobMetrics?.recordSucceeded('lifecycle_sweep');
    } catch (error) {
      this.logger.error('Lifecycle sweep failed', error instanceof Error ? error.stack : undefined);
      this.retentionObservability.emitSweepFailure({ mode, error });
      this.backgroundJobMetrics?.recordFailed('lifecycle_sweep');
    }
  }
}
