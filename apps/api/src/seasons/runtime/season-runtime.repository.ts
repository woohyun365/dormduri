import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

export const seasonRuntimeSelect = {
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
    where: {
      dormitory: {
        isActive: true,
        matchingSupported: true,
      },
    },
    select: {
      dormitoryId: true,
      dormitory: {
        select: {
          id: true,
          nameKo: true,
          roomType: true,
          genderPolicy: true,
        },
      },
      isOperated: true,
      roomSelectionDate: true,
    },
    orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
  },
} satisfies Prisma.SeasonSelect;

@Injectable()
export class SeasonRuntimeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveReferenceTime(now?: Date) {
    if (now) {
      return now;
    }

    const [row] = await this.prisma.$queryRawTyped(getCurrentTimestamp());

    if (!row?.now) {
      return new Date();
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }

  async isCampusOperated(campusCode: Campus) {
    const campusMeta = await this.prisma.campusMaster.findUnique({
      where: { code: campusCode },
      select: { isOperated: true },
    });

    return campusMeta?.isOperated === true;
  }

  async findSeasonRuntimeRows(campusCode: Campus) {
    return this.prisma.season.findMany({
      where: { campusCode },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: seasonRuntimeSelect,
    });
  }
}
