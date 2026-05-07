import { Injectable } from '@nestjs/common';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { dormitoriesErrors } from './dormitories.errors.js';

@Injectable()
export class DormitorySelectableQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
  ) {}

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

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(campus, now);
    if (!seasonContext) {
      return {
        campus: campusMeta,
        items: [],
      };
    }

    const operations = await this.prisma.seasonDormitoryOperation.findMany({
      where: {
        seasonId: seasonContext.season.id,
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
}
