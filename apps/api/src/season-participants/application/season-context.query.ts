import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus } from '../../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import {
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from '../../seasons/ports/season-context.port.js';
import { hasActiveSeasonOverride } from '../../seasons/ports/season-context.port.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { DbClient, SeasonParticipantUseCaseDeps } from './season-participant-use-case.deps.js';

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

export async function assertReadableSeasonContext(
  deps: SeasonParticipantUseCaseDeps,
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
  deps: SeasonParticipantUseCaseDeps,
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
  deps: SeasonParticipantUseCaseDeps,
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
