import type { Campus, Gender } from '../../generated/prisma/enums.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { DbClient, SeasonParticipantUseCaseDeps } from './season-participant-use-case.deps.js';

export type VerifiedSeasonActionUser = {
  id: string;
  campus: Campus;
  gender: Gender;
  emailVerifiedAt: Date | null;
  deletedAt: Date | null;
  displayIdentity: {
    userId: string;
    nickname: string;
    nicknameNormalized: string;
  } | null;
  academicIdentity: {
    userId: string;
    collegeCode: string;
    birthYear: number;
  } | null;
};

const userForSeasonActionSelect = {
  id: true,
  campus: true,
  gender: true,
  emailVerifiedAt: true,
  deletedAt: true,
  displayIdentity: {
    select: {
      userId: true,
      nickname: true,
      nicknameNormalized: true,
    },
  },
  academicIdentity: {
    select: {
      userId: true,
      collegeCode: true,
      birthYear: true,
    },
  },
} as const;

export async function getVerifiedUserForSeasonAction(
  deps: SeasonParticipantUseCaseDeps,
  userId: string,
  client: DbClient = deps.prisma,
): Promise<VerifiedSeasonActionUser> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: userForSeasonActionSelect,
  });

  if (!user || !user.emailVerifiedAt || user.deletedAt) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }

  return user;
}
