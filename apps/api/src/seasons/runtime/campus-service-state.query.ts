import type { SeasonState } from '@repo/shared/season/runtime';
import type { CurrentSeasonContext } from '../ports/season-context.port.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../ports/season-context.port.js';

export interface CampusServiceState {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  seasonContext: CurrentSeasonContext | null;
}

export async function resolveCampusServiceState(
  prisma: PrismaService,
  seasonsService: SeasonContextPort,
  campus: Campus,
  now: Date,
): Promise<CampusServiceState> {
  const campusMeta = await prisma.campusMaster.findUnique({
    where: { code: campus },
    select: { isOperated: true },
  });

  if (!campusMeta?.isOperated) {
    return {
      campusOperated: false,
      seasonState: null,
      seasonContext: null,
    };
  }

  const seasonContext = await seasonsService.getCurrentSeasonContext(campus, now);
  if (!seasonContext) {
    return {
      campusOperated: true,
      seasonState: 'OFF_SEASON',
      seasonContext: null,
    };
  }

  return {
    campusOperated: true,
    seasonState: seasonContext.state,
    seasonContext,
  };
}
