import { Injectable } from '@nestjs/common';
import { normalizeNickname } from '../auth/auth.utils.js';
import { validateLifestyleData } from '../auth/lifestyle.schema.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import { profilesErrors } from './profiles.errors.js';
import { resolveProfileVisibilityScope } from './profile-visibility.js';
import { toPublicProfile, type UserWithProfileRecord } from './profile.mapper.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import { validateNicknameFormat } from '../auth/auth.utils.js';
import { UsersService } from '../users/users.service.js';
import type { PublicProfileListResponse } from '@repo/shared/profile-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';

interface ProfileListQuery {
  offset: number;
  limit: number;
}

type UserWithParticipantProjection = UserWithProfileRecord & {
  seasonParticipants?: CurrentSeasonParticipantRecord[];
};

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly usersService: UsersService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
  ) {}

  async getProfiles(
    authUser: AuthenticatedUserContext,
    query: ProfileListQuery,
  ): Promise<PublicProfileListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const viewer = await this.getUserWithProfile(authUser.id);
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      viewer.campus,
      now,
    );
    const viewerParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(viewer, now);
    const viewerSelection = this.seasonParticipantsService.selectCanonicalSelection(
      viewer,
      viewerParticipant,
    );
    const scope = resolveProfileVisibilityScope({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      selectionState: viewerSelection.dormitorySelectionState,
      dormitoryId: viewerSelection.dormitoryId,
    });

    if (scope.type === 'none') {
      return { items: [] };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: viewer.id },
        campus: viewer.campus,
        gender: viewer.gender,
        profile: {
          isNot: null,
        },
      },
      select: this.userWithProfileSelect(serviceState.seasonContext?.season.id ?? null),
    });

    const visibleUsers = users
      .filter((user) => this.isVisibleToViewer(user, viewer, scope))
      .sort((left, right) => {
        const leftParticipant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
          left.seasonParticipants,
        );
        const rightParticipant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
          right.seasonParticipants,
        );
        const leftNickname = this.seasonParticipantsService.selectCanonicalProfile(
          left.profile!,
          leftParticipant?.profile ?? null,
        ).nickname;
        const rightNickname = this.seasonParticipantsService.selectCanonicalProfile(
          right.profile!,
          rightParticipant?.profile ?? null,
        ).nickname;
        return leftNickname.localeCompare(rightNickname, 'ko');
      })
      .slice(query.offset, query.offset + query.limit)
      .map((user) => {
        const participant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
          user.seasonParticipants,
        );
        const profile = this.seasonParticipantsService.selectCanonicalProfile(
          user.profile!,
          participant?.profile ?? null,
        );
        return toPublicProfile(user, profile);
      });

    return {
      items: visibleUsers,
    };
  }

  async getProfileByUserId(authUser: AuthenticatedUserContext, targetUserId: string) {
    if (authUser.id === targetUserId) {
      throw profilesErrors.profileNotVisible();
    }

    const now = await this.prisma.getDatabaseNow();
    const viewer = await this.getUserWithProfile(authUser.id);
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      viewer.campus,
      now,
    );
    const viewerParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(viewer, now);
    const viewerSelection = this.seasonParticipantsService.selectCanonicalSelection(
      viewer,
      viewerParticipant,
    );
    const scope = resolveProfileVisibilityScope({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      selectionState: viewerSelection.dormitorySelectionState,
      dormitoryId: viewerSelection.dormitoryId,
    });

    if (scope.type === 'none') {
      throw profilesErrors.profileNotVisible();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: this.userWithProfileSelect(serviceState.seasonContext?.season.id ?? null),
    });

    if (!user || !this.isVisibleToViewer(user, viewer, scope)) {
      throw profilesErrors.profileNotVisible();
    }

    const participant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const profile = this.seasonParticipantsService.selectCanonicalProfile(
      user.profile!,
      participant?.profile ?? null,
    );

    return toPublicProfile(user, profile);
  }

  async updateLifestyle(
    authUser: AuthenticatedUserContext,
    lifestyle: Record<string, unknown>,
  ): Promise<CurrentUserResponse> {
    const parsedLifestyle = validateLifestyleData(lifestyle);
    if (!parsedLifestyle.ok) {
      throw profilesErrors.invalidLifestyle(parsedLifestyle.error);
    }

    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithProfile(authUser.id);
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const canonicalSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );

    if (
      serviceState.campusOperated &&
      serviceState.seasonState === 'SEASON_MATCHING' &&
      canonicalSelection.dormitorySelectionState === 'ASSIGNED'
    ) {
      throw profilesErrors.profileEditLocked();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.update({
        where: { userId: authUser.id },
        data: {
          lifestyle: parsedLifestyle.value,
        },
      });

      if (currentParticipant?.profile) {
        await tx.seasonParticipantProfile.update({
          where: { participantId: currentParticipant.id },
          data: {
            lifestyle: parsedLifestyle.value,
          },
        });
      }
    });

    return this.usersService.getCurrentUser(authUser);
  }

  async updateNickname(
    authUser: AuthenticatedUserContext,
    nickname: string,
  ): Promise<CurrentUserResponse> {
    const trimmedNickname = nickname.trim();
    const formatError = validateNicknameFormat(trimmedNickname);
    if (formatError) {
      throw profilesErrors.invalidNickname(formatError);
    }

    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithProfile(authUser.id);
    if (!user.profile) {
      throw new Error('[ProfilesService] user profile row is required');
    }
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );

    if (
      serviceState.campusOperated &&
      serviceState.seasonState !== null &&
      serviceState.seasonState !== 'OFF_SEASON'
    ) {
      throw profilesErrors.nicknameEditLocked();
    }

    if (hasNicknameCooldown(user.profile.nicknameChangedAt, now)) {
      throw profilesErrors.nicknameCooldownActive();
    }

    const nicknamePolicyError =
      await this.moderationService.validateNicknamePolicy(trimmedNickname);
    if (nicknamePolicyError) {
      throw profilesErrors.nicknameModerationRejected(nicknamePolicyError);
    }

    const nicknameNormalized = normalizeNickname(trimmedNickname);
    const existingNickname = await this.prisma.userProfile.findUnique({
      where: { nicknameNormalized },
      select: { userId: true },
    });

    if (existingNickname && existingNickname.userId !== authUser.id) {
      throw profilesErrors.nicknameAlreadyTaken();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userProfile.update({
        where: { userId: authUser.id },
        data: {
          nickname: trimmedNickname,
          nicknameNormalized,
          nicknameChangedAt: now,
        },
      });

      if (currentParticipant?.profile) {
        await tx.seasonParticipantProfile.update({
          where: { participantId: currentParticipant.id },
          data: {
            nicknameSnapshot: trimmedNickname,
            nicknameNormalizedSnapshot: nicknameNormalized,
            templateSourceUserProfileUpdatedAt: user.profile!.updatedAt,
          },
        });
      }
    });

    return this.usersService.getCurrentUser(authUser);
  }

  private isVisibleToViewer(
    user: UserWithParticipantProjection,
    viewer: UserWithProfileRecord,
    scope: ReturnType<typeof resolveProfileVisibilityScope>,
  ) {
    if (!user.profile) {
      return false;
    }

    if (scope.type === 'same-campus') {
      return user.campus === viewer.campus && user.gender === viewer.gender;
    }

    const participant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const selection = this.seasonParticipantsService.selectCanonicalSelection(user, participant);

    if (scope.type === 'same-dormitory') {
      return (
        user.gender === viewer.gender &&
        selection.dormitorySelectionState === 'ASSIGNED' &&
        selection.dormitoryId === scope.dormitoryId
      );
    }

    return false;
  }

  private async getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userWithProfileSelect(null),
    });

    if (!user) {
      throw new Error('[ProfilesService] authenticated user not found');
    }

    return user;
  }

  private userWithProfileSelect(seasonId: string | null) {
    return {
      id: true,
      email: true,
      emailVerifiedAt: true,
      gender: true,
      campus: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      seasonParticipants: seasonId
        ? {
            where: { seasonId },
            take: 1,
            select: {
              id: true,
              seasonId: true,
              userId: true,
              participationIntent: true,
              registeredAt: true,
              declinedAt: true,
              dormitoryId: true,
              dormitorySelectionState: true,
              participantStatus: true,
              campusCodeSnapshot: true,
              genderSnapshot: true,
              joinedAt: true,
              activatedAt: true,
              matchedAt: true,
              withdrawnAt: true,
              expiredAt: true,
              hiddenByAdminAt: true,
              hiddenReasonCode: true,
              hiddenReasonDetail: true,
              deactivatedAt: true,
              createdAt: true,
              updatedAt: true,
              profile: {
                select: {
                  participantId: true,
                  nicknameSnapshot: true,
                  nicknameNormalizedSnapshot: true,
                  lifestyle: true,
                  intro: true,
                  messageToRoommate: true,
                  collegeCode: true,
                  grade: true,
                  mbti: true,
                  birthYear: true,
                  templateSourceUserProfileUpdatedAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          }
        : undefined,
      profile: {
        select: {
          userId: true,
          nickname: true,
          nicknameNormalized: true,
          nicknameChangedAt: true,
          lifestyle: true,
          intro: true,
          messageToRoommate: true,
          collegeCode: true,
          grade: true,
          mbti: true,
          birthYear: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    } as const;
  }
}
