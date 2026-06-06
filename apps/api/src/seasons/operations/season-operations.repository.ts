import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonOperationSnapshotSource } from './season-operations.mapper.js';

export const seasonOperationSelect = {
  id: true,
  campusCode: true,
  name: true,
  preparationStartDate: true,
  matchingStartDate: true,
  seasonEndDate: true,
  updatedAt: true,
  overrideState: true,
  overrideReason: true,
  overrideStartedAt: true,
  overrideEndsAt: true,
} satisfies Prisma.SeasonSelect;

export type SeasonOperationRecord = SeasonOperationSnapshotSource;

@Injectable()
export class SeasonOperationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  findByCampusAndId(client: Prisma.TransactionClient, campusCode: Campus, seasonId: string) {
    return client.season.findFirst({
      where: { id: seasonId, campusCode },
      select: seasonOperationSelect,
    });
  }

  updateScheduleIfVersionMatches(
    client: Prisma.TransactionClient,
    input: {
      seasonId: string;
      campusCode: Campus;
      expectedUpdatedAt: Date;
      name?: string;
      preparationStartDate: Date;
      matchingStartDate: Date;
      seasonEndDate: Date;
    },
  ) {
    return client.season.updateMany({
      where: {
        id: input.seasonId,
        campusCode: input.campusCode,
        updatedAt: input.expectedUpdatedAt,
      },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        preparationStartDate: input.preparationStartDate,
        matchingStartDate: input.matchingStartDate,
        seasonEndDate: input.seasonEndDate,
      },
    });
  }

  updateOverrideIfVersionMatches(
    client: Prisma.TransactionClient,
    input: {
      seasonId: string;
      campusCode: Campus;
      expectedUpdatedAt: Date;
      overrideState: Prisma.SeasonUpdateManyMutationInput['overrideState'];
      overrideReason: string;
      overrideStartedAt: Date | null;
      overrideEndsAt: Date | null;
    },
  ) {
    return client.season.updateMany({
      where: {
        id: input.seasonId,
        campusCode: input.campusCode,
        updatedAt: input.expectedUpdatedAt,
      },
      data: {
        overrideState: input.overrideState,
        overrideReason: input.overrideReason,
        overrideStartedAt: input.overrideStartedAt,
        overrideEndsAt: input.overrideEndsAt,
      },
    });
  }

  clearOverrideIfVersionMatches(
    client: Prisma.TransactionClient,
    input: { seasonId: string; campusCode: Campus; expectedUpdatedAt: Date },
  ) {
    return client.season.updateMany({
      where: {
        id: input.seasonId,
        campusCode: input.campusCode,
        updatedAt: input.expectedUpdatedAt,
      },
      data: {
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    });
  }
}
