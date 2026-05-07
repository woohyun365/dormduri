import { Injectable } from '@nestjs/common';
import type { CurrentUserResponse } from '@repo/shared/user-contract';
import {
  MIN_PROFILE_BIRTH_YEAR,
  profileGradeSchema,
  profileMbtiSchema,
} from '@repo/shared/profile-contract';
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
import { hasNicknameCooldown } from '../profiles/nickname-policy.js';
import { resolveCampusServiceState } from './service-state.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  hasParticipantProfile,
  isParticipantRegistered,
  resolveCurrentUserProfileSource,
  resolveCurrentUserProfileEditability,
} from '../season-participants/season-participant-policy.js';
import {
  buildCurrentUserCapabilityInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';

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
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly matchesService: MatchesService,
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
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const serviceState = await resolveCampusServiceState(
      this.prisma,
      this.seasonsService,
      user.campus,
      now,
    );
    const participantRegistered = isParticipantRegistered(currentParticipant);
    const canonicalSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );
    const currentProfileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });

    if (
      participantRegistered &&
      !hasParticipantProfile(currentParticipant) &&
      (serviceState.seasonState === 'SEASON_OPEN' ||
        serviceState.seasonState === 'SEASON_MATCHING' ||
        serviceState.seasonState === 'SEASON_POST_MATCH')
    ) {
      throw new Error(
        '[UsersService] registered participant profile is required during current season',
      );
    }

    const nicknameLockedBySeason = currentProfileSource === 'SEASON_PARTICIPANT_PROFILE';
    const nicknameCooldownActive = user.profile
      ? hasNicknameCooldown(user.profile.nicknameChangedAt, now)
      : false;
    const operatedDormitoryIds = toOperatedDormitoryIdSet(serviceState.seasonContext);
    const currentDormitoryCanMatch = canCurrentDormitoryMatch(
      serviceState.seasonContext,
      canonicalSelection.dormitoryId,
      now,
    );
    const profileEdit = resolveCurrentUserProfileEditability(
      buildCurrentUserCapabilityInput({
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
        participant: currentParticipant,
        participantMatched: false,
        selection: canonicalSelection,
        operatedDormitoryIds,
        currentDormitoryCanMatch,
        nicknameLockedBySeason,
        nicknameCooldownActive,
      }),
    );

    const userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    } = {};
    const profileUpdateData: {
      intro?: string;
      messageToRoommate?: string | null;
      collegeCode?: string | null;
      grade?: string | null;
      mbti?: string | null;
      birthYear?: number | null;
    } = {};
    const seasonParticipantUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
      participantStatus?: 'DRAFT' | 'ACTIVE';
      activatedAt?: Date | null;
    } = {};
    const seasonParticipantProfileUpdateData: {
      intro?: string;
      messageToRoommate?: string | null;
      collegeCode?: string | null;
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

      if (!profileEdit.intro) {
        throw usersErrors.profileFieldLocked(
          'intro',
          '현재 시즌 상태에서는 자기소개를 수정할 수 없습니다.',
        );
      }

      if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
        seasonParticipantProfileUpdateData.intro = intro;
        profileUpdateData.intro = intro;
      } else {
        profileUpdateData.intro = intro;
      }
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

      if (!profileEdit.messageToRoommate) {
        throw usersErrors.profileFieldLocked(
          'messageToRoommate',
          '현재 시즌 상태에서는 룸메이트에게 남길 말을 수정할 수 없습니다.',
        );
      }

      if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
        seasonParticipantProfileUpdateData.messageToRoommate = normalizedMessage;
      } else {
        profileUpdateData.messageToRoommate = normalizedMessage;
      }
    }

    if (input.additional) {
      if (!profileEdit.additional) {
        throw usersErrors.profileFieldLocked(
          'additional',
          '현재 시즌 상태에서는 추가 프로필을 수정할 수 없습니다.',
        );
      }

      if (input.additional.college !== undefined) {
        const college = await this.assertCollegeCodeForCampus(
          user.campus,
          input.additional.college,
        );
        if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.collegeCode = college?.code ?? null;
        }
        profileUpdateData.collegeCode = college?.code ?? null;
      }

      if (input.additional.grade !== undefined) {
        if (
          input.additional.grade !== null &&
          !profileGradeSchema.safeParse(input.additional.grade).success
        ) {
          throw usersErrors.invalidPatch('grade 값이 올바르지 않습니다.', 'additional.grade');
        }
        if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.grade = input.additional.grade;
        }
        profileUpdateData.grade = input.additional.grade;
      }

      if (input.additional.mbti !== undefined) {
        const mbti = input.additional.mbti?.trim()
          ? input.additional.mbti.trim().toUpperCase()
          : null;
        if (mbti && !profileMbtiSchema.safeParse(mbti).success) {
          throw usersErrors.invalidPatch('MBTI 형식이 올바르지 않습니다.', 'additional.mbti');
        }
        if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.mbti = mbti;
        }
        profileUpdateData.mbti = mbti;
      }

      if (input.additional.birthYear !== undefined) {
        const birthYear = input.additional.birthYear;
        if (birthYear !== null) {
          const currentYear = Number.parseInt(formatKstDate(now).slice(0, 4), 10);
          if (birthYear < MIN_PROFILE_BIRTH_YEAR || birthYear > currentYear) {
            throw usersErrors.invalidPatch(
              'birthYear 값이 올바르지 않습니다.',
              'additional.birthYear',
            );
          }
        }
        if (currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.birthYear = birthYear;
        }
        profileUpdateData.birthYear = birthYear;
      }
    }

    if (input.selection) {
      this.assertSelectionPayload(input.selection);
      await this.applySelectionUpdate(
        user,
        currentParticipant,
        serviceState,
        now,
        input.selection,
        userUpdateData,
        seasonParticipantUpdateData,
      );
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

      if (currentParticipant && Object.keys(seasonParticipantUpdateData).length > 0) {
        await tx.seasonParticipant.update({
          where: { id: currentParticipant.id },
          data: seasonParticipantUpdateData,
        });
      }

      if (
        currentParticipant?.profile &&
        Object.keys(seasonParticipantProfileUpdateData).length > 0
      ) {
        await tx.seasonParticipantProfile.update({
          where: { participantId: currentParticipant.id },
          data: seasonParticipantProfileUpdateData,
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
    const currentParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now);
    const participantRegistered = isParticipantRegistered(currentParticipant);
    if (
      participantRegistered &&
      !hasParticipantProfile(currentParticipant) &&
      (serviceState.seasonState === 'SEASON_OPEN' ||
        serviceState.seasonState === 'SEASON_MATCHING' ||
        serviceState.seasonState === 'SEASON_POST_MATCH')
    ) {
      throw new Error(
        '[UsersService] registered participant profile is required during current season',
      );
    }
    const activeMatch =
      currentParticipant && serviceState.seasonContext
        ? await this.matchesService.getCurrentActiveMatchSummaryForParticipant(
            serviceState.seasonContext,
            currentParticipant.id,
            now,
          )
        : null;
    const canonicalSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );
    const profileSource = resolveCurrentUserProfileSource({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participantRegistered,
      participantProfileExists: hasParticipantProfile(currentParticipant),
    });
    const canonicalProfile = this.seasonParticipantsService.selectProfileBySource(
      user.profile,
      currentParticipant?.profile ?? null,
      profileSource,
    );
    const lifestyle = parseLifestyleOrThrow(canonicalProfile.lifestyle);
    const additional = toAdditionalProfile(canonicalProfile);
    const nicknameLockedBySeason = canonicalProfile.source === 'SEASON_PARTICIPANT_PROFILE';
    const nicknameCooldownActive = hasNicknameCooldown(user.profile.nicknameChangedAt, now);
    const browseProfiles = true;
    const operatedDormitoryIds = toOperatedDormitoryIdSet(serviceState.seasonContext);
    const currentDormitoryCanMatch = canCurrentDormitoryMatch(
      serviceState.seasonContext,
      canonicalSelection.dormitoryId,
      now,
    );
    const capabilityInput = buildCurrentUserCapabilityInput({
      campusOperated: serviceState.campusOperated,
      seasonState: serviceState.seasonState,
      participant: currentParticipant,
      participantMatched: activeMatch !== null,
      selection: canonicalSelection,
      operatedDormitoryIds,
      currentDormitoryCanMatch,
      nicknameLockedBySeason,
      nicknameCooldownActive,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: canonicalProfile.nickname,
        gender: user.gender,
        campus: user.campus,
      },
      selection: {
        state: canonicalSelection.dormitorySelectionState,
        dormitoryId: canonicalSelection.dormitoryId,
        source: canonicalSelection.source,
      },
      profile: {
        source: canonicalProfile.source,
        lifestyle,
        intro: canonicalProfile.intro,
        messageToRoommate: canonicalProfile.messageToRoommate,
        additional,
      },
      participation: {
        hasCurrentSeason: Boolean(serviceState.seasonContext),
        hasParticipantRow: Boolean(currentParticipant),
        intent: currentParticipant?.participationIntent ?? null,
        registered: participantRegistered,
        profileExists: hasParticipantProfile(currentParticipant),
      },
      match: {
        hasActiveMatch: activeMatch !== null,
        activeMatch,
      },
      readiness: buildUserReadiness({
        lifestyle,
        intro: canonicalProfile.intro,
        messageToRoommate: canonicalProfile.messageToRoommate,
        additional,
        selectionState: canonicalSelection.dormitorySelectionState,
        canBrowseProfiles: browseProfiles,
      }),
      capabilities: buildCurrentUserCapabilities(capabilityInput),
      serviceState: {
        campusOperated: serviceState.campusOperated,
        seasonState: serviceState.seasonState,
      },
    };
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
    currentParticipant: Awaited<
      ReturnType<SeasonParticipantsService['ensureCurrentSeasonParticipantForUser']>
    >,
    serviceState: Awaited<ReturnType<typeof resolveCampusServiceState>>,
    now: Date,
    selection: NonNullable<UpdateCurrentUserInput['selection']>,
    userUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    },
    seasonParticipantUpdateData: {
      dormitoryId?: string | null;
      dormitorySelectionState?: 'NOT_SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
      participantStatus?: 'DRAFT' | 'ACTIVE';
      activatedAt?: Date | null;
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

    if (!currentParticipant || !isParticipantRegistered(currentParticipant)) {
      throw usersErrors.dormitorySelectionRequiresParticipation();
    }

    const canonicalSelection = this.seasonParticipantsService.selectCanonicalSelection(
      user,
      currentParticipant,
    );

    if (canonicalSelection.dormitorySelectionState === 'ASSIGNED') {
      throw usersErrors.dormitoryAlreadyConfirmed();
    }

    if (selection.state === 'UNASSIGNED') {
      if (serviceState.seasonState !== 'SEASON_OPEN') {
        throw usersErrors.dormitorySelectionNotAllowed();
      }

      if (
        canonicalSelection.dormitorySelectionState === 'UNASSIGNED' &&
        canonicalSelection.dormitoryId === null
      ) {
        return;
      }

      userUpdateData.dormitorySelectionState = 'UNASSIGNED';
      userUpdateData.dormitoryId = null;
      seasonParticipantUpdateData.dormitorySelectionState = 'UNASSIGNED';
      seasonParticipantUpdateData.dormitoryId = null;
      seasonParticipantUpdateData.participantStatus = 'DRAFT';
      seasonParticipantUpdateData.activatedAt = null;
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
    seasonParticipantUpdateData.dormitorySelectionState = 'ASSIGNED';
    seasonParticipantUpdateData.dormitoryId = dormitory.id;
    seasonParticipantUpdateData.participantStatus = 'ACTIVE';
    seasonParticipantUpdateData.activatedAt = now;
  }

  private async getUserWithProfile(userId: string): Promise<UserWithProfileRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
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
            collegeCode: true,
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

  private async assertCollegeCodeForCampus(
    campus: UserWithProfileRecord['campus'],
    collegeCode: string | null,
  ) {
    if (!collegeCode) {
      return null;
    }

    const college = await this.prisma.collegeMaster.findUnique({
      where: { code: collegeCode },
      select: {
        code: true,
        campusCode: true,
        nameKo: true,
        isActive: true,
      },
    });

    if (!college || !college.isActive) {
      throw usersErrors.invalidPatch('college 값이 올바르지 않습니다.', 'additional.college');
    }

    if (college.campusCode !== campus) {
      throw usersErrors.invalidPatch(
        '현재 캠퍼스에서 선택할 수 없는 단과대입니다.',
        'additional.college',
      );
    }

    return college;
  }
}
