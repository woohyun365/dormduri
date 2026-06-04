import type { Prisma } from '../generated/prisma/client.js';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import type { ChatThreadWithdrawalPort } from '../chat/application/ports/chat-thread-withdrawal.port.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import type { DormitorySelectionCatalogPort } from '../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import {
  formatKstDate,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from '../seasons/season.utils.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';

export interface SeasonParticipantOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  dormitorySelectionCatalog: DormitorySelectionCatalogPort;
  chatThreadWithdrawal: ChatThreadWithdrawalPort;
}

export type DbClient = Prisma.TransactionClient | PrismaService;

const seasonContextSelect = {
  id: true,
  campusCode: true,
  name: true,
  preparationStartDate: true,
  matchingStartDate: true,
  seasonEndDate: true,
  overrideState: true,
  overrideReason: true,
  overrideStartedAt: true,
  overrideEndsAt: true,
  dormitoryOperations: {
    select: {
      dormitoryId: true,
      isOperated: true,
      roomSelectionDate: true,
    },
    orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
  },
} satisfies Prisma.SeasonSelect;

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
  deps: SeasonParticipantOwnerDeps,
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

export async function assertReadableSeasonContext(
  deps: SeasonParticipantOwnerDeps,
  campus: Campus,
  now: Date,
  client?: DbClient,
) {
  const seasonContext = client
    ? await getCurrentSeasonContextFromClient(client, campus, now)
    : await deps.seasonsService.getCurrentSeasonContext(campus, now);
  if (!seasonContext) {
    throw seasonParticipantsErrors.seasonProfileDraftNotAllowed();
  }

  return seasonContext;
}

export async function assertWritableSeasonContext(
  deps: SeasonParticipantOwnerDeps,
  campus: Campus,
  now: Date,
  client?: DbClient,
) {
  const seasonContext = client
    ? await getCurrentSeasonContextFromClient(client, campus, now)
    : await deps.seasonsService.getCurrentSeasonContext(campus, now);
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
  client?: DbClient,
) {
  const seasonContext = client
    ? await getCurrentSeasonContextFromClient(client, campus, now)
    : await deps.seasonsService.getCurrentSeasonContext(campus, now);
  if (
    !seasonContext ||
    (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
  ) {
    throw seasonParticipantsErrors.registrationNotAllowed();
  }

  return seasonContext;
}

async function getCurrentSeasonContextFromClient(
  client: DbClient,
  campusCode: Campus,
  now: Date,
): Promise<CurrentSeasonContext | null> {
  const campusMeta = await client.campusMaster.findUnique({
    where: { code: campusCode },
    select: { isOperated: true },
  });

  if (!campusMeta?.isOperated) {
    return null;
  }

  const seasons = await client.season.findMany({
    where: { campusCode },
    orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
    select: seasonContextSelect,
  });

  if (seasons.length === 0) {
    return null;
  }

  const normalizedSeasons = seasons.map(normalizeSeasonRuntimeRow);
  const today = formatKstDate(now);
  const currentSeasons = normalizedSeasons.filter(
    (season) => season.preparationStartDate <= today && season.seasonEndDate >= today,
  );
  const overrideSeason = currentSeasons.find((season) => hasActiveSeasonOverride(season, now));
  const selectedSeason = overrideSeason ?? currentSeasons[0] ?? null;

  return selectedSeason ? toCurrentSeasonResponse(selectedSeason, now) : null;
}
