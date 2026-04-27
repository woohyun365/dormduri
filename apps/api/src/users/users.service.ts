import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { usersErrors } from './users.errors.js';
import {
  parseLifestyleOrThrow,
  toAdditionalProfile,
  type UserWithProfileRecord,
} from '../profiles/profile.mapper.js';
import { buildUserReadiness } from './user-readiness.js';
import { buildUserCapabilities, canBrowseProfiles } from './user-capabilities.js';
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import { resolveCampusServiceState } from './service-state.js';
import { ModerationService } from '../common/moderation/moderation.service.js';

const MBTI_REGEX = /^[EI][SN][TF][JP]$/;
const GRADE_VALUES = new Set(['1', '2', '3', '4+']);
const COLLEGE_MAX_LENGTH = 50;

interface UpdateCurrentUserInput {
  selection?: {
    state: 'UNASSIGNED' | 'ASSIGNED';
    dormitoryId: string | null;
  };
  intro?: string;
  messageToRoommate?: string | null;
  additional?: {
    college?: string | null;
    grade?: string | null;
    mbti?: string | null;
    birthYear?: number | null;
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
  ) {}

  async getCurrentUser(authUser: AuthenticatedUserContext): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithProfile(authUser.id);
    return this.buildCurrentUserResponse(user, now);
  }

  async updateCurrentUser(
    authUser: AuthenticatedUserContext,
    input: UpdateCurrentUserInput,
  ): Promise<CurrentUserResponse> {
    const now = await this.prisma.getDatabaseNow();
    const user = await this.getUserWithProfile(authUser.id);
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );

    const userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    } = {};
    const profileUpdateData: {
      intro?: string;
      messageToRoommate?: string | null;
      college?: string | null;
      grade?: string | null;
      mbti?: string | null;
      birthYear?: number | null;
    } = {};

    if (input.intro !== undefined) {
      const intro = input.intro.trim();
      const moderation = await this.moderationService.moderatePublicText(intro, 'intro');
      if (!moderation.ok) {
        throw usersErrors.textModerationRejected('intro', moderation.error);
      }
      profileUpdateData.intro = intro;
    }

    if (input.messageToRoommate !== undefined) {
      const normalizedMessage = input.messageToRoommate?.trim()
        ? input.messageToRoommate.trim()
        : null;
      const moderation = await this.moderationService.moderatePublicText(
        normalizedMessage ?? '',
        'messageToRoommate',
      );
      if (!moderation.ok) {
        throw usersErrors.textModerationRejected('messageToRoommate', moderation.error);
      }
      profileUpdateData.messageToRoommate = normalizedMessage;
    }

    if (input.additional) {
      if (input.additional.college !== undefined) {
        const college = input.additional.college?.trim() ? input.additional.college.trim() : null;
        if (college && college.length > COLLEGE_MAX_LENGTH) {
          throw usersErrors.invalidPatch(
            `college는 ${COLLEGE_MAX_LENGTH}자 이하여야 합니다.`,
            'additional.college',
          );
        }
        profileUpdateData.college = college;
      }

      if (input.additional.grade !== undefined) {
        if (input.additional.grade !== null && !GRADE_VALUES.has(input.additional.grade)) {
          throw usersErrors.invalidPatch('grade 값이 올바르지 않습니다.', 'additional.grade');
        }
        profileUpdateData.grade = input.additional.grade;
      }

      if (input.additional.mbti !== undefined) {
        const mbti = input.additional.mbti?.trim()
          ? input.additional.mbti.trim().toUpperCase()
          : null;
        if (mbti && !MBTI_REGEX.test(mbti)) {
          throw usersErrors.invalidPatch('MBTI 형식이 올바르지 않습니다.', 'additional.mbti');
        }
        profileUpdateData.mbti = mbti;
      }

      if (input.additional.birthYear !== undefined) {
        const birthYear = input.additional.birthYear;
        if (birthYear !== null) {
          const currentYear = Number.parseInt(formatKstDate(now).slice(0, 4), 10);
          if (birthYear < 1900 || birthYear > currentYear) {
            throw usersErrors.invalidPatch(
              'birthYear 값이 올바르지 않습니다.',
              'additional.birthYear',
            );
          }
        }
        profileUpdateData.birthYear = birthYear;
      }
    }

    if (input.selection) {
      this.assertSelectionPayload(input.selection);
      await this.applySelectionUpdate(user, serviceState, now, input.selection, userUpdateData);
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userUpdateData,
        });
      }

      if (Object.keys(profileUpdateData).length > 0) {
        await tx.userProfile.update({
          where: { userId: user.id },
          data: profileUpdateData,
        });
      }
    });

    return this.buildCurrentUserResponse(await this.getUserWithProfile(authUser.id), now);
  }

  private async buildCurrentUserResponse(
    user: UserWithProfileRecord,
    now: Date,
  ): Promise<CurrentUserResponse> {
    if (!user.profile) {
      throw new Error('[UsersService] user profile row is required');
    }

    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const lifestyle = parseLifestyleOrThrow(user.profile.lifestyle);
    const additional = toAdditionalProfile(user.profile);
    const nicknameLockedBySeason =
      serviceState.campusOperated &&
      serviceState.seasonState !== null &&
      serviceState.seasonState !== 'OFF_SEASON';
    const nicknameCooldownActive = hasNicknameCooldown(user.profile.nicknameChangedAt, now);
    const currentDormitoryCanMatch = this.canCurrentDormitoryMatch(
      serviceState.seasonContext,
      user.dormitoryId,
      now,
    );
    const browseProfiles = canBrowseProfiles({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      selectionState: user.dormitorySelectionState,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.profile.nickname,
        gender: user.gender,
        campus: user.campus,
      },
      selection: {
        state: user.dormitorySelectionState,
        dormitoryId: user.dormitoryId,
      },
      profile: {
        lifestyle,
        intro: user.profile.intro,
        messageToRoommate: user.profile.messageToRoommate,
        additional,
      },
      readiness: buildUserReadiness({
        lifestyle,
        intro: user.profile.intro,
        messageToRoommate: user.profile.messageToRoommate,
        additional,
        selectionState: user.dormitorySelectionState,
        canBrowseProfiles: browseProfiles,
      }),
      capabilities: buildUserCapabilities({
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
        selectionState: user.dormitorySelectionState,
        nicknameLockedBySeason,
        nicknameCooldownActive,
        hasSelectableDormitories: (serviceState.seasonContext?.operatedDormitories.length ?? 0) > 0,
        currentDormitoryCanMatch,
      }),
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
    };
  }

  private canCurrentDormitoryMatch(
    seasonContext: Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>,
    dormitoryId: string | null,
    now: Date,
  ) {
    if (!seasonContext || !dormitoryId || seasonContext.state !== 'SEASON_MATCHING') {
      return false;
    }

    const dormitory = seasonContext.operatedDormitories.find(
      (item) => item.dormitoryId === dormitoryId,
    );
    if (!dormitory) {
      return false;
    }

    const today = formatKstDate(now);
    return today >= seasonContext.schedule.matchingStart && today <= dormitory.roomSelectionDate;
  }

  private assertSelectionPayload(selection: NonNullable<UpdateCurrentUserInput['selection']>) {
    if (selection.state === 'ASSIGNED' && !selection.dormitoryId) {
      throw usersErrors.invalidPatch(
        'ASSIGNED 선택에는 dormitoryId가 필요합니다.',
        'selection.dormitoryId',
      );
    }

    if (selection.state === 'UNASSIGNED' && selection.dormitoryId !== null) {
      throw usersErrors.invalidPatch(
        'UNASSIGNED 선택에는 dormitoryId가 없어야 합니다.',
        'selection.dormitoryId',
      );
    }
  }

  private async applySelectionUpdate(
    user: UserWithProfileRecord,
    serviceState: Awaited<ReturnType<typeof resolveCampusServiceState>>,
    now: Date,
    selection: NonNullable<UpdateCurrentUserInput['selection']>,
    userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    },
  ) {
    if (!serviceState.campusOperated || serviceState.seasonState === null) {
      throw usersErrors.dormitorySelectionNotAllowed();
    }

    if (
      serviceState.seasonState === 'OFF_SEASON' ||
      serviceState.seasonState === 'SEASON_POST_MATCH' ||
      !serviceState.seasonContext
    ) {
      throw usersErrors.dormitorySelectionNotAllowed();
    }

    if (user.dormitorySelectionState === 'ASSIGNED') {
      throw usersErrors.dormitoryAlreadyConfirmed();
    }

    if (selection.state === 'UNASSIGNED') {
      if (serviceState.seasonState !== 'SEASON_PREPARATION') {
        throw usersErrors.dormitorySelectionNotAllowed();
      }

      if (user.dormitorySelectionState === 'UNASSIGNED' && user.dormitoryId === null) {
        return;
      }

      userUpdateData.dormitorySelectionState = 'UNASSIGNED';
      userUpdateData.dormitoryId = null;
      return;
    }

    const operatedDormitory = serviceState.seasonContext.operatedDormitories.find(
      (item) => item.dormitoryId === selection.dormitoryId,
    );

    if (!operatedDormitory) {
      throw usersErrors.invalidDormitoryForUser('현재 시즌에서 선택할 수 없는 기숙사입니다.');
    }

    if (
      serviceState.seasonState === 'SEASON_MATCHING' &&
      formatKstDate(now) > operatedDormitory.roomSelectionDate
    ) {
      throw usersErrors.invalidDormitoryForUser('이미 매칭 마감일이 지난 기숙사입니다.');
    }

    const dormitory = await this.prisma.dormitory.findUnique({
      where: { id: selection.dormitoryId ?? undefined },
      select: {
        id: true,
        campusCode: true,
        genderPolicy: true,
      },
    });

    if (
      !dormitory ||
      dormitory.campusCode !== user.campus ||
      (dormitory.genderPolicy !== user.gender && dormitory.genderPolicy !== 'BOTH')
    ) {
      throw usersErrors.invalidDormitoryForUser();
    }

    userUpdateData.dormitorySelectionState = 'ASSIGNED';
    userUpdateData.dormitoryId = dormitory.id;
  }

  private async getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
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
      },
    });

    if (!user) {
      throw new Error('[UsersService] authenticated user not found');
    }

    return user;
  }
}
