import { Module } from '@nestjs/common';
import { AuthOperationsModule } from '../auth/operations/auth-operations.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { RetentionModule } from '../retention/retention.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SocialSafetyModule } from '../social-safety/social-safety.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  LIFECYCLE_SWEEP_TASK_PROVIDERS,
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
} from './adapters/lifecycle-sweep-tasks.adapter.js';
import { SeasonBoundaryScheduleAdapter } from './adapters/season-boundary-schedule.adapter.js';
import { LifecycleSweepService } from './lifecycle-sweep.service.js';
import { LIFECYCLE_BOUNDARY_SCHEDULE, LIFECYCLE_SWEEP_TASKS } from './lifecycle-sweep.tokens.js';

@Module({
  imports: [
    PrismaModule,
    AuthOperationsModule,
    ChatModule,
    MatchesModule,
    SeasonParticipantsModule,
    SocialSafetyModule,
    RetentionModule,
    UsersModule,
  ],
  providers: [
    SeasonBoundaryScheduleAdapter,
    ...LIFECYCLE_SWEEP_TASK_PROVIDERS,
    {
      provide: LIFECYCLE_BOUNDARY_SCHEDULE,
      useExisting: SeasonBoundaryScheduleAdapter,
    },
    {
      provide: LIFECYCLE_SWEEP_TASKS,
      useFactory: (
        matchTransitions: MatchLifecycleTransitionSweepTask,
        threadTransitions: ChatThreadLifecycleSweepTask,
        matchHistory: MatchHistoryMaterializationSweepTask,
        participantBackfill: SeasonParticipantBackfillSweepTask,
        socialSafetyBookmarkCleanup: SocialSafetyBookmarkCleanupSweepTask,
        threadRetentionActivation: ThreadRetentionActivationSweepTask,
        archiveJob: ArchiveJobRetrySweepTask,
        retainedIdentityDisposal: RetainedIdentityDisposalSweepTask,
        retentionReviewJob: RetentionReviewJobRetrySweepTask,
        retentionAccessLogDisposal: RetentionAccessLogDisposalSweepTask,
        authCleanup: AuthOperationalCleanupSweepTask,
      ) => [
        matchTransitions,
        threadTransitions,
        matchHistory,
        participantBackfill,
        socialSafetyBookmarkCleanup,
        threadRetentionActivation,
        archiveJob,
        retainedIdentityDisposal,
        retentionReviewJob,
        retentionAccessLogDisposal,
        authCleanup,
      ],
      inject: [
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
      ],
    },
    LifecycleSweepService,
  ],
  exports: [LifecycleSweepService],
})
export class LifecycleModule {}
