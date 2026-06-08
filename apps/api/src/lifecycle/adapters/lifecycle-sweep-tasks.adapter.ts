import { Inject, Injectable } from '@nestjs/common';
import {
  CHAT_LIFECYCLE_SWEEP_PORT,
  type ChatLifecycleSweepPort,
} from '../../chat/application/ports/chat-lifecycle-sweep.port.js';
import { AuthOperationalCleanupService } from '../../auth/operations/auth-operational-cleanup.service.js';
import { MatchesService } from '../../matches/matches.service.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import { UsersService } from '../../users/users.service.js';
import { BookmarkLifecycleService } from '../../social-safety/bookmarks/application/bookmark-lifecycle.service.js';
import type { LifecycleSweepTaskPort } from '../lifecycle-sweep-task.port.js';

@Injectable()
export class MatchLifecycleTransitionSweepTask implements LifecycleSweepTaskPort<'matchTransitions'> {
  readonly name = 'matchTransitions' as const;
  readonly order = 10;

  constructor(private readonly matchesService: MatchesService) {}

  run(now: Date) {
    return this.matchesService.sweepLifecycleTransitions(now);
  }
}

@Injectable()
export class ChatThreadLifecycleSweepTask implements LifecycleSweepTaskPort<'threadTransitions'> {
  readonly name = 'threadTransitions' as const;
  readonly order = 20;

  constructor(
    @Inject(CHAT_LIFECYCLE_SWEEP_PORT)
    private readonly chatLifecycleSweep: ChatLifecycleSweepPort,
  ) {}

  run(now: Date) {
    return this.chatLifecycleSweep.sweepThreadLifecycle(now);
  }
}

@Injectable()
export class MatchHistoryMaterializationSweepTask implements LifecycleSweepTaskPort<'matchHistory'> {
  readonly name = 'matchHistory' as const;
  readonly order = 30;

  constructor(private readonly matchesService: MatchesService) {}

  run(now: Date) {
    return this.matchesService.sweepHistoryMaterialization(now);
  }
}

@Injectable()
export class SeasonParticipantBackfillSweepTask implements LifecycleSweepTaskPort<'participantBackfill'> {
  readonly name = 'participantBackfill' as const;
  readonly order = 40;

  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  run(now: Date) {
    return this.seasonParticipantsService.backfillCurrentSeasonParticipants(now);
  }
}

@Injectable()
export class SocialSafetyBookmarkCleanupSweepTask implements LifecycleSweepTaskPort<'socialSafetyBookmarkCleanupSweep'> {
  readonly name = 'socialSafetyBookmarkCleanupSweep' as const;
  readonly order = 45;

  constructor(private readonly bookmarkLifecycleService: BookmarkLifecycleService) {}

  run(now: Date) {
    return this.bookmarkLifecycleService.expireEndedSeasonBookmarks(now);
  }
}

@Injectable()
export class ThreadRetentionActivationSweepTask implements LifecycleSweepTaskPort<'threadRetentionActivationSweep'> {
  readonly name = 'threadRetentionActivationSweep' as const;
  readonly order = 50;

  constructor(private readonly usersService: UsersService) {}

  run(now: Date) {
    return this.usersService.activateThreadRetentionJobsForArchivedThreads(now);
  }
}

@Injectable()
export class ArchiveJobRetrySweepTask implements LifecycleSweepTaskPort<'archiveJobSweep'> {
  readonly name = 'archiveJobSweep' as const;
  readonly order = 60;

  constructor(private readonly usersService: UsersService) {}

  run(now: Date) {
    return this.usersService.retryDueDeletionArchiveJobs(now);
  }
}

@Injectable()
export class RetainedIdentityDisposalSweepTask implements LifecycleSweepTaskPort<'retainedIdentityDisposalSweep'> {
  readonly name = 'retainedIdentityDisposalSweep' as const;
  readonly order = 70;

  constructor(private readonly usersService: UsersService) {}

  run(now: Date) {
    return this.usersService.disposeExpiredRetainedIdentities(now);
  }
}

@Injectable()
export class RetentionReviewJobRetrySweepTask implements LifecycleSweepTaskPort<'retentionReviewJobSweep'> {
  readonly name = 'retentionReviewJobSweep' as const;
  readonly order = 80;

  constructor(private readonly usersService: UsersService) {}

  run(now: Date) {
    return this.usersService.retryDueRetentionReviewJobs(now);
  }
}

@Injectable()
export class RetentionAccessLogDisposalSweepTask implements LifecycleSweepTaskPort<'retentionAccessLogDisposalSweep'> {
  readonly name = 'retentionAccessLogDisposalSweep' as const;
  readonly order = 90;

  constructor(private readonly usersService: UsersService) {}

  run(now: Date) {
    return this.usersService.disposeDueRetentionAccessLogs(now);
  }
}

@Injectable()
export class AuthOperationalCleanupSweepTask implements LifecycleSweepTaskPort<'authCleanupSweep'> {
  readonly name = 'authCleanupSweep' as const;
  readonly order = 100;

  constructor(private readonly authOperationalCleanupService: AuthOperationalCleanupService) {}

  run(now: Date) {
    return this.authOperationalCleanupService.runCleanupBatch(now);
  }
}

export const LIFECYCLE_SWEEP_TASK_PROVIDERS = [
  MatchLifecycleTransitionSweepTask,
  ChatThreadLifecycleSweepTask,
  MatchHistoryMaterializationSweepTask,
  SeasonParticipantBackfillSweepTask,
  SocialSafetyBookmarkCleanupSweepTask,
  ThreadRetentionActivationSweepTask,
  ArchiveJobRetrySweepTask,
  RetainedIdentityDisposalSweepTask,
  RetentionReviewJobRetrySweepTask,
  RetentionAccessLogDisposalSweepTask,
  AuthOperationalCleanupSweepTask,
] as const;
