import { Injectable } from '@nestjs/common';
import type {
  AccountDeletionRequestAccepted,
  CurrentUserResponse,
  DismissCurrentUserOnboardingNoticeRequest,
  RequestAccountDeletion,
} from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { CurrentUserViewService } from './current-user-view.service.js';
import { createUserUpdateOwner, type UpdateCurrentUserInput } from './user-update-owner.js';
import { createUserDeletionOwner } from './user-deletion-owner.js';
import { createUserOnboardingOwner } from './user-onboarding-owner.js';
import type {
  ArchiveJobActivationResult,
  ArchiveJobSweepResult,
} from '../retention/archive-job-owner.js';
import type { RetainedIdentityDisposalResult } from '../retention/retained-identity-owner.js';

@Injectable()
export class UsersService {
  private readonly updateOwner;
  private readonly deletionOwner;
  private readonly onboardingOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly currentUserViewService: CurrentUserViewService,
  ) {
    this.updateOwner = createUserUpdateOwner({
      prisma: this.prisma,
      moderationService: this.moderationService,
      currentUserViewService: this.currentUserViewService,
    });
    this.deletionOwner = createUserDeletionOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
    });
    this.onboardingOwner = createUserOnboardingOwner({
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
  ): Promise<CurrentUserResponse> {
    return this.updateOwner.updateCurrentUser(authUser, input);
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
}
