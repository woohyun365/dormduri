import { Inject, Injectable } from '@nestjs/common';
import type {
  AccountDeletionRequestAccepted,
  CurrentUserResponse,
  DismissCurrentUserOnboardingNoticeRequest,
  RequestAccountDeletion,
  UpdateCurrentUserResponse,
} from '@repo/shared/user';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import {
  PrismaService,
  RetentionWorkerPrismaService,
} from '../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { CurrentUserViewService } from '../current-user/current-user-view.service.js';
import { createUserUpdateOwner, type UpdateCurrentUserInput } from './user-update-owner.js';
import {
  createOverrideDisplayIdentityNicknameCommand,
  type DisplayIdentityNicknameOverrideInput,
  type DisplayIdentityNicknameOverrideResult,
} from '../operations/override-display-identity-nickname.command.js';
import {
  listDisplayIdentityNicknameChangeAuditForOperations,
  type DisplayIdentityNicknameChangeAuditEntry,
} from '../operations/list-display-identity-nickname-audit.query.js';
import { createRequestAccountDeletionCommand } from '../account-deletion/request-account-deletion.command.js';
import { createDismissOnboardingNoticeCommand } from '../onboarding/dismiss-onboarding-notice.command.js';
import { DisplayIdentityNicknamePolicyService } from '../identity/display/display-identity-nickname-policy.service.js';

@Injectable()
export class UsersService {
  private readonly updateOwner;
  private readonly deletionOwner;
  private readonly onboardingOwner;
  private readonly nicknameOverrideOwner;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retentionWorkerPrisma: RetentionWorkerPrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly nicknamePolicy: DisplayIdentityNicknamePolicyService,
    private readonly currentUserViewService: CurrentUserViewService,
  ) {
    this.updateOwner = createUserUpdateOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      nicknamePolicy: this.nicknamePolicy,
      currentUserViewService: this.currentUserViewService,
    });
    this.nicknameOverrideOwner = createOverrideDisplayIdentityNicknameCommand({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      nicknamePolicy: this.nicknamePolicy,
    });
    this.deletionOwner = createRequestAccountDeletionCommand({
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
    return this.nicknameOverrideOwner.overrideDisplayIdentityNicknameForPolicyEnforcement(input);
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
}
