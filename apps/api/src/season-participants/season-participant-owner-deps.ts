import type { Prisma } from '../generated/prisma/client.js';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { DormitoriesService } from '../dormitories/dormitories.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';

export interface SeasonParticipantOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  dormitoriesService: DormitoriesService;
}

export type DbClient = Prisma.TransactionClient | PrismaService;

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
} as const;

export async function getVerifiedUserForSeasonAction(
  deps: SeasonParticipantOwnerDeps,
  userId: string,
  client: DbClient = deps.prisma,
): Promise<VerifiedSeasonActionUser> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: userForSeasonActionSelect,
  });

  if (!user || !user.emailVerifiedAt || user.deletedAt || !user.displayIdentity) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }

  return user;
}

export async function assertReadableSeasonContext(
  deps: SeasonParticipantOwnerDeps,
  campus: Campus,
  now: Date,
) {
  const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
  if (!seasonContext) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }

  return seasonContext;
}

export async function assertWritableSeasonContext(
  deps: SeasonParticipantOwnerDeps,
  campus: Campus,
  now: Date,
) {
  const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
  if (
    !seasonContext ||
    (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
  ) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }

  return seasonContext;
}

export async function assertRegistrationSeasonContext(
  deps: SeasonParticipantOwnerDeps,
  campus: Campus,
  now: Date,
) {
  const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus, now);
  if (
    !seasonContext ||
    (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
  ) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }

  return seasonContext;
}
