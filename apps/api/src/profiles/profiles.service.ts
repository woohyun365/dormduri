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

interface ProfileListQuery {
  offset: number;
  limit: number;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly usersService: UsersService,
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
    const scope = resolveProfileVisibilityScope({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      selectionState: viewer.dormitorySelectionState,
      dormitoryId: viewer.dormitoryId,
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
      select: this.userWithProfileSelect(),
    });

    const visibleUsers = users
      .filter((user) => this.isVisibleToViewer(user, viewer, scope))
      .sort((left, right) => {
        const leftNickname = left.profile?.nickname ?? '';
        const rightNickname = right.profile?.nickname ?? '';
        return leftNickname.localeCompare(rightNickname, 'ko');
      })
      .slice(query.offset, query.offset + query.limit)
      .map((user) => toPublicProfile(user));

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
    const scope = resolveProfileVisibilityScope({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      selectionState: viewer.dormitorySelectionState,
      dormitoryId: viewer.dormitoryId,
    });

    if (scope.type === 'none') {
      throw profilesErrors.profileNotVisible();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: this.userWithProfileSelect(),
    });

    if (!user || !this.isVisibleToViewer(user, viewer, scope)) {
      throw profilesErrors.profileNotVisible();
    }

    return toPublicProfile(user);
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
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );

    if (
      serviceState.campusOperated &&
      serviceState.seasonState === 'SEASON_MATCHING' &&
      user.dormitorySelectionState === 'ASSIGNED'
    ) {
      throw profilesErrors.profileEditLocked();
    }

    await this.prisma.userProfile.update({
      where: { userId: authUser.id },
      data: {
        lifestyle: parsedLifestyle.value,
      },
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

    await this.prisma.userProfile.update({
      where: { userId: authUser.id },
      data: {
        nickname: trimmedNickname,
        nicknameNormalized,
        nicknameChangedAt: now,
      },
    });

    return this.usersService.getCurrentUser(authUser);
  }

  private isVisibleToViewer(
    user: UserWithProfileRecord,
    viewer: UserWithProfileRecord,
    scope: ReturnType<typeof resolveProfileVisibilityScope>,
  ) {
    if (!user.profile) {
      return false;
    }

    if (scope.type === 'same-campus') {
      return user.campus === viewer.campus && user.gender === viewer.gender;
    }

    if (scope.type === 'same-dormitory') {
      return (
        user.gender === viewer.gender &&
        user.dormitorySelectionState === 'ASSIGNED' &&
        user.dormitoryId === scope.dormitoryId
      );
    }

    return false;
  }

  private async getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userWithProfileSelect(),
    });

    if (!user) {
      throw new Error('[ProfilesService] authenticated user not found');
    }

    return user;
  }

  private userWithProfileSelect() {
    return {
      id: true,
      email: true,
      gender: true,
      campus: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: {
          userId: true,
          nickname: true,
          nicknameNormalized: true,
          nicknameChangedAt: true,
          lifestyle: true,
          intro: true,
          messageToRoommate: true,
          college: true,
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
