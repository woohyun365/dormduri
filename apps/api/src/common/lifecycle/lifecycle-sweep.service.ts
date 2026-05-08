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
import { toDateOnlyString } from '@repo/shared/date-primitives';
import { ChatService } from '../../chat/chat.service.js';
import lifecycleConfig from '../../config/lifecycle.config.js';
import { MatchesService } from '../../matches/matches.service.js';
import { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import { subtractDays } from '../../seasons/season.utils.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PERIODIC_INTERVAL_NAME = 'lifecycle-periodic-sweep';
const BOUNDARY_JOB_PREFIX = 'lifecycle-boundary';

export interface LifecycleSweepResult {
  ranAt: string;
  matchTransitions: Awaited<ReturnType<MatchesService['sweepLifecycleTransitions']>>;
  threadTransitions: Awaited<ReturnType<ChatService['sweepThreadLifecycle']>>;
  participantBackfill: Awaited<
    ReturnType<SeasonParticipantsService['backfillCurrentSeasonParticipants']>
  >;
}

interface LifecycleBoundaryJob {
  name: string;
  runAt: Date;
}

@Injectable()
export class LifecycleSweepService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LifecycleSweepService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly matchesService: MatchesService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(lifecycleConfig.KEY)
    private readonly lifecycleSettings: ConfigType<typeof lifecycleConfig>,
  ) {}

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
    const referenceNow = now ?? (await this.prisma.getDatabaseNow());
    const matchTransitions = await this.matchesService.sweepLifecycleTransitions(referenceNow);
    const threadTransitions = await this.chatService.sweepThreadLifecycle(referenceNow);
    const participantBackfill =
      await this.seasonParticipantsService.backfillCurrentSeasonParticipants(referenceNow);

    return {
      ranAt: referenceNow.toISOString(),
      matchTransitions,
      threadTransitions,
      participantBackfill,
    };
  }

  async runPeriodicSweep(now?: Date): Promise<LifecycleSweepResult> {
    return this.runSweep(now);
  }

  async runBoundarySweep(now?: Date): Promise<LifecycleSweepResult> {
    return this.runSweep(now);
  }

  async refreshBoundarySchedules(now?: Date) {
    if (!this.lifecycleSettings.sweepEnabled) {
      return;
    }

    const referenceNow = now ?? (await this.prisma.getDatabaseNow());
    const desiredJobs = await this.buildBoundaryJobs(referenceNow);

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

  private async buildBoundaryJobs(referenceNow: Date): Promise<LifecycleBoundaryJob[]> {
    const seasons = await this.prisma.season.findMany({
      where: {
        campus: {
          isOperated: true,
        },
      },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        preparationStartDate: true,
        matchingStartDate: true,
        seasonEndDate: true,
        dormitoryOperations: {
          where: {
            isOperated: true,
          },
          select: {
            dormitoryId: true,
            roomSelectionDate: true,
          },
          orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
        },
      },
    });

    const jobs: LifecycleBoundaryJob[] = [];
    for (const season of seasons) {
      jobs.push(
        ...this.toBoundaryJobsForSeason(
          {
            id: season.id,
            preparationStartDate: toDateOnlyString(season.preparationStartDate),
            matchingStartDate: toDateOnlyString(season.matchingStartDate),
            seasonEndDate: toDateOnlyString(season.seasonEndDate),
            dormitoryOperations: season.dormitoryOperations.map((operation) => ({
              dormitoryId: operation.dormitoryId,
              roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
            })),
          },
          referenceNow,
        ),
      );
    }

    return jobs;
  }

  private toBoundaryJobsForSeason(
    season: {
      id: string;
      preparationStartDate: string;
      matchingStartDate: string;
      seasonEndDate: string;
      dormitoryOperations: Array<{
        dormitoryId: string;
        roomSelectionDate: string;
      }>;
    },
    referenceNow: Date,
  ) {
    const jobs: LifecycleBoundaryJob[] = [];

    this.pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:preparation-start`,
      this.toKstBoundaryInstant(season.preparationStartDate),
      referenceNow,
    );
    this.pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:matching-start`,
      this.toKstBoundaryInstant(season.matchingStartDate),
      referenceNow,
    );
    this.pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:season-end-next-day`,
      this.toKstBoundaryInstant(subtractDays(season.seasonEndDate, -1)),
      referenceNow,
    );

    for (const operation of season.dormitoryOperations) {
      this.pushBoundaryJob(
        jobs,
        `${BOUNDARY_JOB_PREFIX}:${season.id}:room-selection-next-day:${operation.dormitoryId}`,
        this.toKstBoundaryInstant(subtractDays(operation.roomSelectionDate, -1)),
        referenceNow,
      );
    }

    return jobs;
  }

  private pushBoundaryJob(
    target: LifecycleBoundaryJob[],
    name: string,
    runAt: Date,
    referenceNow: Date,
  ) {
    if (runAt.getTime() <= referenceNow.getTime()) {
      return;
    }

    target.push({ name, runAt });
  }

  private toKstBoundaryInstant(localDate: string) {
    return new Date(`${localDate}T00:00:00+09:00`);
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
