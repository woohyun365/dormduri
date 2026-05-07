import { Injectable } from '@nestjs/common';
import type { PublicProfileListResponse } from '@repo/shared/profile-contract';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { normalizeNickname, validateNicknameFormat } from '../auth/auth.utils.js';
import { validateLifestyleData } from '../auth/lifestyle.schema.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  isParticipantRegistered,
  isVisibleRegisteredParticipant,
  resolveCurrentUserProfileSource,
  hasOperatedAssignedDormitory,
} from '../season-participants/season-participant-policy.js';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
} from '../season-participants/season-participants.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { resolveCampusServiceState } from '../users/service-state.js';
import { UsersService } from '../users/users.service.js';
import { toPublicProfile, type UserWithProfileRecord } from './profile.mapper.js';
import { resolveProfileExposure } from './profile-visibility.js';
import { hasNicknameCooldown } from './nickname-policy.js';
import { profilesErrors } from './profiles.errors.js';

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
    private readonly matchesService: MatchesService,
  ) {}

  async getProfiles(
    authUser: AuthenticatedUserContext,
    query: { offset: number; limit: number },
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
    const operatedDormitoryIds = new Set(
      serviceState.seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );

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

    const currentSeasonId = serviceState.seasonContext?.season.id ?? null;
    const participantIds = [
      viewerParticipant?.id ?? null,
      ...users.map(
        (user) =>
          this.seasonParticipantsService.pickCurrentSeasonParticipant(user.seasonParticipants)
            ?.id ?? null,
      ),
    ].filter((participantId): participantId is string => participantId !== null);
    const activeMatchMap = currentSeasonId
      ? await this.matchesService.getLiveActiveMatchMapForParticipantIds(
          currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerParticipant
      ? (activeMatchMap.get(viewerParticipant.id) ?? null)
      : null;

    const visibleUsers = users
      .map((user) =>
        this.toVisiblePublicProfile(
          user,
          viewerParticipant,
          viewerActiveMatch,
          viewerSelection,
          serviceState.campusOperated,
          serviceState.seasonState,
          operatedDormitoryIds,
          canCurrentDormitoryMatch(serviceState.seasonContext, viewerSelection.dormitoryId, now),
          activeMatchMap,
        ),
      )
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => left.nickname.localeCompare(right.nickname, 'ko'))
      .slice(query.offset, query.offset + query.limit)
      .map(({ profile }) => profile);

    return { items: visibleUsers };
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
    const operatedDormitoryIds = new Set(
      serviceState.seasonContext?.operatedDormitories.map((item) => item.dormitoryId) ?? [],
    );

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: this.userWithProfileSelect(serviceState.seasonContext?.season.id ?? null),
    });
    if (!user) {
      throw profilesErrors.profileNotVisible();
    }

    const targetParticipant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const currentSeasonId = serviceState.seasonContext?.season.id ?? null;
    const participantIds = [viewerParticipant?.id ?? null, targetParticipant?.id ?? null].filter(
      (participantId): participantId is string => participantId !== null,
    );
    const activeMatchMap = currentSeasonId
      ? await this.matchesService.getLiveActiveMatchMapForParticipantIds(
          currentSeasonId,
          participantIds,
        )
      : new Map<
          string,
          Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
        >();
    const viewerActiveMatch = viewerParticipant
      ? (activeMatchMap.get(viewerParticipant.id) ?? null)
      : null;

    const visibleProfile = this.toVisiblePublicProfile(
      user,
      viewerParticipant,
      viewerActiveMatch,
      viewerSelection,
      serviceState.campusOperated,
      serviceState.seasonState,
      operatedDormitoryIds,
      canCurrentDormitoryMatch(serviceState.seasonContext, viewerSelection.dormitoryId, now),
      activeMatchMap,
    );
    if (!visibleProfile) {
      throw profilesErrors.profileNotVisible();
    }

    return visibleProfile.profile;
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
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const currentProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });

    if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
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
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const currentProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });

    if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
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

  private toVisiblePublicProfile(
    user: UserWithParticipantProjection,
    viewerParticipant: CurrentSeasonParticipantRecord | null,
    viewerActiveMatch: Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>,
    viewerSelection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>,
    campusOperated: boolean,
    seasonState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null,
    operatedDormitoryIds: Set<string>,
    currentDormitoryCanMatch: boolean,
    activeMatchMap: Map<
      string,
      Awaited<ReturnType<MatchesService['getCurrentActiveMatchByParticipantId']>>
    >,
  ) {
    if (!user.profile) {
      return null;
    }

    const targetParticipant = this.seasonParticipantsService.pickCurrentSeasonParticipant(
      user.seasonParticipants,
    );
    const targetSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      targetParticipant,
    );
    const targetActiveMatch = targetParticipant
      ? (activeMatchMap.get(targetParticipant.id) ?? null)
      : null;
    const exposure = resolveProfileExposure({
      viewer: {
        campusOperated,
        seasonState,
        registered: isParticipantRegistered(viewerParticipant),
        matched: viewerActiveMatch !== null,
        matchedPartnerParticipantId: viewerActiveMatch?.counterpartParticipantId ?? null,
        selectionState: viewerSelection.dormitorySelectionState,
        dormitoryId: viewerSelection.dormitoryId,
        hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
          operatedDormitoryIds,
          viewerSelection.dormitorySelectionState,
          viewerSelection.dormitoryId,
        ),
        currentDormitoryCanMatch,
      },
      target: {
        participantId: targetParticipant?.id ?? null,
        visible:
          seasonState === 'OFF_SEASON' || seasonState === null
            ? true
            : isVisibleRegisteredParticipant(targetParticipant),
        registered: isParticipantRegistered(targetParticipant),
        matched: targetActiveMatch !== null,
        selectionState: targetSelection.dormitorySelectionState,
        dormitoryId: targetSelection.dormitoryId,
        hasOperatedAssignedDormitory: hasOperatedAssignedDormitory(
          operatedDormitoryIds,
          targetSelection.dormitorySelectionState,
          targetSelection.dormitoryId,
        ),
        hasSeasonProfile: hasParticipantProfile(targetParticipant),
      },
    });

    if (!exposure) {
      return null;
    }

    const sourceProfile = this.seasonParticipantsService.selectProfileBySource(
      user.profile,
      targetParticipant?.profile ?? null,
      exposure.sourceProfile,
    );
    const publicProfile = toPublicProfile(user, sourceProfile, exposure);

    return {
      nickname: sourceProfile.nickname,
      profile: publicProfile,
    };
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
