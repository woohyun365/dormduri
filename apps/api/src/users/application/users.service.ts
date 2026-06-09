import { Inject, Injectable } from '@nestjs/common';
import type {
  AccountDeletionRequestAccepted,
  CurrentUserResponse,
  DismissCurrentUserOnboardingNoticeRequest,
  RequestAccountDeletion,
  UpdateCurrentUserResponse,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { ModerationService } from '../../moderation/moderation.service.js';
import {
  PrismaService,
  RetentionWorkerPrismaService,
} from '../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { CurrentUserViewService } from '../current-user/current-user-view.service.js';
import { createUserUpdateOwner, type UpdateCurrentUserInput } from '../user-update-owner.js';
import type {
  DisplayIdentityNicknameOverrideInput,
  DisplayIdentityNicknameOverrideResult,
} from '../identity/display/update-display-identity.command.js';
import {
  listDisplayIdentityNicknameChangeAuditForOperations,
  type DisplayIdentityNicknameChangeAuditEntry,
} from '../identity/audit/display-identity-nickname-audit.repository.js';
import { createUserDeletionOwner } from '../user-deletion-owner.js';
import { createDismissOnboardingNoticeCommand } from '../onboarding/dismiss-onboarding-notice.command.js';
import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../../retention/archive-job-owner.js';
import type { RetainedIdentityDisposalResult } from '../../retention/retained-identity-owner.js';
import type { RetentionReviewJobSweepResult } from '../../retention/retention-review-job-owner.js';
import type { RetentionAccessLogDisposalResult } from '../../retention/retention-access-log-owner.js';

@Injectable()
export class UsersService {
  private readonly updateOwner;
  private readonly deletionOwner;
  private readonly onboardingOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionWorkerPrisma: RetentionWorkerPrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly moderationService: ModerationService,
    private readonly currentUserViewService: CurrentUserViewService,
  ) {
    this.updateOwner = createUserUpdateOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      moderationService: this.moderationService,
      currentUserViewService: this.currentUserViewService,
    });
    this.deletionOwner = createUserDeletionOwner({
      prisma: this.prisma,
      retentionWorkerPrisma: this.retentionWorkerPrisma,
      seasonsService: this.seasonsService,
    });
    this.onboardingOwner = createDismissOnboardingNoticeCommand({
      prisma: this.prisma,
      currentUserViewService: this.currentUserViewService,
    });
  }

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    return this.currentUserViewService.getCurrentUser(authUser);
  }

  async updateCurrentUser(
    authUser: AuthenticatedUserContext,
    input: UpdateCurrentUserInput,
  ): Promise<UpdateCurrentUserResponse> {
    return this.updateOwner.updateCurrentUser(authUser, input);
  }

  async overrideDisplayIdentityNicknameForPolicyEnforcement(
    input: DisplayIdentityNicknameOverrideInput,
  ): Promise<DisplayIdentityNicknameOverrideResult> {
    return this.updateOwner.overrideDisplayIdentityNicknameForPolicyEnforcement(input);
  }

  async listDisplayIdentityNicknameChangeAuditForOperations(
    userId: string,
  ): Promise<DisplayIdentityNicknameChangeAuditEntry[]> {
    return listDisplayIdentityNicknameChangeAuditForOperations(this.prisma, userId);
  }

  async dismissCurrentUserOnboardingNotice(
    authUser: AuthenticatedUserContext,
    input: DismissCurrentUserOnboardingNoticeRequest,
  ): Promise<CurrentUserResponse> {
    return this.onboardingOwner.dismissCurrentUserOnboardingNotice(authUser, input);
  }

  async requestAccountDeletion(
    authUser: AuthenticatedUserContext,
    input: RequestAccountDeletion,
  ): Promise<AccountDeletionRequestAccepted> {
    return this.deletionOwner.requestAccountDeletion(authUser.id, input);
  }

  async activateThreadRetentionJobsForArchivedThreads(
    now: Date,
  ): Promise<ArchiveJobActivationResult> {
    return this.deletionOwner.activateThreadRetentionJobsForArchivedThreads(now);
  }

  async retryDueDeletionArchiveJobs(now: Date): Promise<ArchiveJobSweepResult> {
    return this.deletionOwner.retryDueDeletionArchiveJobs(now);
  }

  async disposeExpiredRetainedIdentities(now: Date): Promise<RetainedIdentityDisposalResult> {
    return this.deletionOwner.disposeExpiredRetainedIdentities(now);
  }

  async retryDueRetentionReviewJobs(now: Date): Promise<RetentionReviewJobSweepResult> {
    return this.deletionOwner.retryDueRetentionReviewJobs(now);
  }

  async disposeDueRetentionAccessLogs(now: Date): Promise<RetentionAccessLogDisposalResult> {
    return this.deletionOwner.disposeDueRetentionAccessLogs(now);
  }
}
