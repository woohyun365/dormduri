import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { ChatService } from '../../chat/chat.service.js';
import { MatchesService } from '../../matches/matches.service.js';
import { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiEnv } from '../../config/env.js';

export interface LifecycleSweepResult {
  ranAt: string;
  matchTransitions: Awaited<ReturnType<MatchesService['sweepLifecycleTransitions']>>;
  threadTransitions: Awaited<ReturnType<ChatService['sweepThreadLifecycle']>>;
  participantBackfill: Awaited<
    ReturnType<SeasonParticipantsService['backfillCurrentSeasonParticipants']>
  >;
}

@Injectable()
export class LifecycleSweepService {
  private readonly logger = new Logger(LifecycleSweepService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly matchesService: MatchesService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

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

  @Interval('lifecycle-periodic-sweep', apiEnv.lifecycleSweepIntervalMs)
  async handlePeriodicSweepInterval() {
    if (!apiEnv.lifecycleSweepEnabled) {
      return;
    }

    await this.runScheduledSweep('periodic');
  }

  @Cron('0 0 0 * * *', {
    name: 'lifecycle-boundary-sweep-kst-midnight',
    timeZone: 'Asia/Seoul',
    waitForCompletion: true,
    disabled: !apiEnv.lifecycleSweepEnabled,
  })
  async handleBoundarySweepCron() {
    await this.runScheduledSweep('boundary');
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
        await this.runPeriodicSweep();
      }
    } catch (error) {
      this.logger.error('Lifecycle sweep failed', error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }
}
