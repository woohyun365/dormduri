import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ChatService } from '../../chat/chat.service.js';
import lifecycleConfig from '../../config/lifecycle.config.js';
import { MatchesService } from '../../matches/matches.service.js';
import { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import {
  createLifecycleBoundaryJobBuilder,
  BOUNDARY_JOB_PREFIX,
} from './lifecycle-boundary-job-builder.js';
import { createLifecycleSweepRunner } from './lifecycle-sweep-runner.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PERIODIC_INTERVAL_NAME = 'lifecycle-periodic-sweep';

export interface LifecycleSweepResult {
  ranAt: string;
  matchTransitions: Awaited<ReturnType<MatchesService['sweepLifecycleTransitions']>>;
  threadTransitions: Awaited<ReturnType<ChatService['sweepThreadLifecycle']>>;
  participantBackfill: Awaited<
    ReturnType<SeasonParticipantsService['backfillCurrentSeasonParticipants']>
  >;
}

@Injectable()
export class LifecycleSweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleSweepService.name);
  private readonly runner;
  private readonly boundaryJobBuilder;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly matchesService: MatchesService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(lifecycleConfig.KEY)
    private readonly lifecycleSettings: ConfigType<typeof lifecycleConfig>,
  ) {
    this.runner = createLifecycleSweepRunner({
      prisma: this.prisma,
      chatService: this.chatService,
      matchesService: this.matchesService,
      seasonParticipantsService: this.seasonParticipantsService,
    });
    this.boundaryJobBuilder = createLifecycleBoundaryJobBuilder(this.prisma);
  }

  async onApplicationBootstrap() {
    if (!this.lifecycleSettings.sweepEnabled) {
      return;
    }

    this.registerPeriodicInterval();
    await this.refreshBoundarySchedules();
    await this.runScheduledSweep('periodic');
  }

  onModuleDestroy() {
    if (this.schedulerRegistry.doesExist('interval', PERIODIC_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(PERIODIC_INTERVAL_NAME);
    }

    for (const jobName of this.schedulerRegistry.getCronJobs().keys()) {
      if (!jobName.startsWith(BOUNDARY_JOB_PREFIX)) {
        continue;
      }
      this.schedulerRegistry.deleteCronJob(jobName);
    }
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
    if (!this.lifecycleSettings.sweepEnabled) {
      return;
    }

    const referenceNow = now ?? (await this.prisma.getDatabaseNow());
    const desiredJobs = await this.boundaryJobBuilder.buildBoundaryJobs(referenceNow);

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

  private async runScheduledSweep(mode: 'periodic' | 'boundary') {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      if (mode === 'boundary') {
        await this.runBoundarySweep();
      } else {
        await this.refreshBoundarySchedules();
        await this.runPeriodicSweep();
      }
    } catch (error) {
      this.logger.error('Lifecycle sweep failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
