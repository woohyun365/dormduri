import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';
import {
  formatKstDate,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  resolveSeasonSchedule,
} from '../seasons/season.utils.js';

@Injectable()
export class DormitorySelectableQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSelectableDormitories(campus: Campus, gender?: Gender, now?: Date) {
    const campusMeta = await this.prisma.campusMaster.findUnique({
      where: { code: campus },
      select: {
        code: true,
        nameKo: true,
        isOperated: true,
      },
    });

    if (!campusMeta) {
      throw dormitoriesErrors.campusNotFound();
    }

    if (!campusMeta.isOperated) {
      return {
        campus: campusMeta,
        items: [],
      };
    }

    const referenceNow = await this.resolveReferenceTime(now);
    const selectableSeasonId = await this.resolveSelectableSeasonId(campus, referenceNow);
    if (!selectableSeasonId) {
      return {
        campus: campusMeta,
        items: [],
      };
    }

    const operations = await this.prisma.seasonDormitoryOperation.findMany({
      where: {
        seasonId: selectableSeasonId,
        isOperated: true,
        dormitory: {
          campusCode: campus,
          ...(gender ? { OR: [{ genderPolicy: gender }, { genderPolicy: 'BOTH' }] } : {}),
        },
      },
      select: {
        roomSelectionDate: true,
        dormitory: {
          select: {
            id: true,
            nameKo: true,
            roomType: true,
            genderPolicy: true,
            sortOrder: true,
          },
        },
      },
    });

    const items = operations
      .sort((a, b) => {
        const roomSelectionDateCompare = a.roomSelectionDate
          .toISOString()
          .localeCompare(b.roomSelectionDate.toISOString());
        if (roomSelectionDateCompare !== 0) {
          return roomSelectionDateCompare;
        }

        const sortOrderCompare = a.dormitory.sortOrder - b.dormitory.sortOrder;
        if (sortOrderCompare !== 0) {
          return sortOrderCompare;
        }

        return a.dormitory.id.localeCompare(b.dormitory.id);
      })
      .map((operation) => ({
        id: operation.dormitory.id,
        name: operation.dormitory.nameKo,
        roomType: operation.dormitory.roomType as 2 | 3,
        genderPolicy: operation.dormitory.genderPolicy,
        isOperated: true,
      }));

    return {
      campus: campusMeta,
      items,
    };
  }

  private async resolveSelectableSeasonId(campus: Campus, referenceNow: Date) {
    const seasons = await this.prisma.season.findMany({
      where: { campusCode: campus },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: {
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
        },
      },
    });

    if (seasons.length === 0) {
      return null;
    }

    const normalizedSeasons = seasons.map(normalizeSeasonRuntimeRow);
    const today = formatKstDate(referenceNow);

    const overrideSeason = normalizedSeasons.find((season) =>
      hasActiveSeasonOverride(season, referenceNow),
    );
    const currentOrUpcomingSeason = normalizedSeasons.find(
      (season) => resolveSeasonSchedule(season).seasonEnd >= today,
    );

    return (overrideSeason ?? currentOrUpcomingSeason)?.id ?? null;
  }

  private async resolveReferenceTime(now?: Date) {
    if (now) {
      return now;
    }

    const [row] = await this.prisma.$queryRaw<{ now: Date }[]>`
      SELECT CURRENT_TIMESTAMP AS "now"
    `;

    if (!row?.now) {
      return new Date();
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }
}
