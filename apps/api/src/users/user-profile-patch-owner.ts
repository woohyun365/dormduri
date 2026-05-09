import {
  MIN_PROFILE_BIRTH_YEAR,
  profileGradeSchema,
  profileMbtiSchema,
} from '@repo/shared/profile-contract';
import type { ModerationService } from '../common/moderation/moderation.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { usersErrors } from './users.errors.js';
import type { UserWithProfileRecord } from '../profiles/profile.mapper.js';

interface UserProfilePatchOwnerDeps {
  prisma: PrismaService;
  moderationService: ModerationService;
}

interface AdditionalInput {
  college?: string | null;
  grade?: string | null;
  mbti?: string | null;
  birthYear?: number | null;
}

interface ProfileEditState {
  intro: boolean;
  messageToRoommate: boolean;
  additional: boolean;
}

interface ProfileUpdatePayloadInput {
  user: UserWithProfileRecord;
  input: {
    intro?: string;
    messageToRoommate?: string | null;
    additional?: AdditionalInput;
  };
  now: Date;
  currentProfileSource: 'USER_PROFILE' | 'SEASON_PARTICIPANT_PROFILE';
  profileEdit: ProfileEditState;
}

export function createUserProfilePatchOwner(deps: UserProfilePatchOwnerDeps) {
  async function assertCollegeCodeForCampus(
    campus: UserWithProfileRecord['campus'],
    collegeCode: string | null,
  ) {
    if (!collegeCode) {
      return null;
    }

    const college = await deps.prisma.collegeMaster.findUnique({
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

  async function buildProfileUpdatePayloads(input: ProfileUpdatePayloadInput) {
    const profileUpdateData: {
      intro?: string;
      messageToRoommate?: string | null;
      collegeCode?: string | null;
      grade?: string | null;
      mbti?: string | null;
      birthYear?: number | null;
    } = {};
    const seasonParticipantProfileUpdateData: {
      intro?: string;
      messageToRoommate?: string | null;
      collegeCode?: string | null;
      grade?: string | null;
      mbti?: string | null;
      birthYear?: number | null;
    } = {};

    if (input.input.intro !== undefined) {
      const intro = input.input.intro.trim();
      const moderation = await deps.moderationService.moderatePublicText(intro, 'intro');
      if (!moderation.ok) {
        throw usersErrors.textModerationRejected('intro', moderation.error);
      }

      if (!input.profileEdit.intro) {
        throw usersErrors.profileFieldLocked(
          'intro',
          '현재 시즌 상태에서는 자기소개를 수정할 수 없습니다.',
        );
      }

      if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
        seasonParticipantProfileUpdateData.intro = intro;
        profileUpdateData.intro = intro;
      } else {
        profileUpdateData.intro = intro;
      }
    }

    if (input.input.messageToRoommate !== undefined) {
      const normalizedMessage = input.input.messageToRoommate?.trim()
        ? input.input.messageToRoommate.trim()
        : null;
      const moderation = await deps.moderationService.moderatePublicText(
        normalizedMessage ?? '',
        'messageToRoommate',
      );
      if (!moderation.ok) {
        throw usersErrors.textModerationRejected('messageToRoommate', moderation.error);
      }

      if (!input.profileEdit.messageToRoommate) {
        throw usersErrors.profileFieldLocked(
          'messageToRoommate',
          '현재 시즌 상태에서는 룸메이트에게 남길 말을 수정할 수 없습니다.',
        );
      }

      if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
        seasonParticipantProfileUpdateData.messageToRoommate = normalizedMessage;
      } else {
        profileUpdateData.messageToRoommate = normalizedMessage;
      }
    }

    if (input.input.additional) {
      if (!input.profileEdit.additional) {
        throw usersErrors.profileFieldLocked(
          'additional',
          '현재 시즌 상태에서는 추가 프로필을 수정할 수 없습니다.',
        );
      }

      if (input.input.additional.college !== undefined) {
        const college = await assertCollegeCodeForCampus(
          input.user.campus,
          input.input.additional.college,
        );
        if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.collegeCode = college?.code ?? null;
        }
        profileUpdateData.collegeCode = college?.code ?? null;
      }

      if (input.input.additional.grade !== undefined) {
        if (
          input.input.additional.grade !== null &&
          !profileGradeSchema.safeParse(input.input.additional.grade).success
        ) {
          throw usersErrors.invalidPatch('grade 값이 올바르지 않습니다.', 'additional.grade');
        }
        if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.grade = input.input.additional.grade;
        }
        profileUpdateData.grade = input.input.additional.grade;
      }

      if (input.input.additional.mbti !== undefined) {
        const mbti = input.input.additional.mbti?.trim()
          ? input.input.additional.mbti.trim().toUpperCase()
          : null;
        if (mbti && !profileMbtiSchema.safeParse(mbti).success) {
          throw usersErrors.invalidPatch('MBTI 형식이 올바르지 않습니다.', 'additional.mbti');
        }
        if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.mbti = mbti;
        }
        profileUpdateData.mbti = mbti;
      }

      if (input.input.additional.birthYear !== undefined) {
        const birthYear = input.input.additional.birthYear;
        if (birthYear !== null) {
          const currentYear = Number.parseInt(formatKstDate(input.now).slice(0, 4), 10);
          if (birthYear < MIN_PROFILE_BIRTH_YEAR || birthYear > currentYear) {
            throw usersErrors.invalidPatch(
              'birthYear 값이 올바르지 않습니다.',
              'additional.birthYear',
            );
          }
        }
        if (input.currentProfileSource === 'SEASON_PARTICIPANT_PROFILE') {
          seasonParticipantProfileUpdateData.birthYear = birthYear;
        }
        profileUpdateData.birthYear = birthYear;
      }
    }

    return {
      profileUpdateData,
      seasonParticipantProfileUpdateData,
    };
  }

  return {
    buildProfileUpdatePayloads,
  };
}
