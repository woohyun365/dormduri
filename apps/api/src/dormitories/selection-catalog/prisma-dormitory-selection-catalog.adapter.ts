import { Injectable } from '@nestjs/common';
import type { SelectableDormitory } from '@repo/shared/season/participation';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import {
  isDormitoryGenderCompatible,
  isDormitoryRoomSelectionClosed,
} from './dormitory-selection-eligibility.policy.js';
import { mapSeasonParticipantSelectableDormitory } from './dormitory-selection-catalog.mapper.js';
import type {
  DormitorySelectionCatalogPort,
  DormitorySelectionValidationReason,
  DormitorySelectionValidationResult,
  SeasonParticipantDormitorySelectionInput,
  SeasonParticipantDormitoryValidationInput,
} from './dormitory-selection-catalog.port.js';

const seasonDormitoryOperationSelect = {
  seasonId: true,
  dormitoryId: true,
  isOperated: true,
  roomSelectionDate: true,
  dormitory: {
    select: {
      id: true,
      campusCode: true,
      nameKo: true,
      roomType: true,
      genderPolicy: true,
      sortOrder: true,
    },
  },
} as const;

type SeasonDormitoryOperationRecord = Prisma.SeasonDormitoryOperationGetPayload<{
  select: typeof seasonDormitoryOperationSelect;
}>;

@Injectable()
export class PrismaDormitorySelectionCatalogAdapter implements DormitorySelectionCatalogPort {
  constructor(private readonly prisma: PrismaService) {}

  async listSelectableDormitoriesForSeasonParticipant(
    input: SeasonParticipantDormitorySelectionInput,
  ): Promise<SelectableDormitory[]> {
    const operations = await this.listSelectableOperationsForSnapshot(input);
    return operations.map(mapSeasonParticipantSelectableDormitory);
  }

  async validateSelectableDormitoryForSeasonParticipant(
    input: SeasonParticipantDormitoryValidationInput,
  ): Promise<DormitorySelectionValidationResult> {
    const client = input.queryClient ?? this.prisma;
    const operation = await client.seasonDormitoryOperation.findUnique({
      where: {
        seasonId_dormitoryId: {
          seasonId: input.seasonContext.season.id,
          dormitoryId: input.dormitoryId,
        },
      },
      select: seasonDormitoryOperationSelect,
    });

    if (!operation) {
      return invalidDormitorySelection('DORMITORY_NOT_FOUND');
    }
    if (!operation.isOperated) {
      return invalidDormitorySelection('DORMITORY_NOT_OPERATED');
    }
    if (operation.dormitory.campusCode !== input.campusCodeSnapshot) {
      return invalidDormitorySelection('DORMITORY_CAMPUS_MISMATCH');
    }
    if (!isDormitoryGenderCompatible(input.genderSnapshot, operation.dormitory.genderPolicy)) {
      return invalidDormitorySelection('DORMITORY_GENDER_MISMATCH');
    }
    if (
      isDormitoryRoomSelectionClosed(input.seasonContext, operation.roomSelectionDate, input.now)
    ) {
      return invalidDormitorySelection('DORMITORY_SELECTION_CLOSED');
    }

    return {
      valid: true,
      item: mapSeasonParticipantSelectableDormitory(operation),
    };
  }

  private async listSelectableOperationsForSnapshot(
    input: SeasonParticipantDormitorySelectionInput,
  ): Promise<SeasonDormitoryOperationRecord[]> {
    const client = input.queryClient ?? this.prisma;
    return client.seasonDormitoryOperation.findMany({
      where: buildSelectableDormitoryWhere(input),
      select: seasonDormitoryOperationSelect,
      orderBy: [
        { roomSelectionDate: 'asc' },
        { dormitory: { sortOrder: 'asc' } },
        { dormitoryId: 'asc' },
      ],
    });
  }
}

function buildSelectableDormitoryWhere(
  input: SeasonParticipantDormitorySelectionInput,
): Prisma.SeasonDormitoryOperationWhereInput {
  const where: Prisma.SeasonDormitoryOperationWhereInput = {
    seasonId: input.seasonContext.season.id,
    isOperated: true,
    dormitory: {
      campusCode: input.campusCodeSnapshot,
      genderPolicy: { in: [input.genderSnapshot, 'BOTH'] },
    },
  };

  if (input.seasonContext.state === 'SEASON_MATCHING') {
    where.roomSelectionDate = {
      gte: new Date(`${formatKstDate(input.now)}T00:00:00.000Z`),
    };
  }

  return where;
}

function invalidDormitorySelection(
  reason: DormitorySelectionValidationReason,
): DormitorySelectionValidationResult {
  return { valid: false, reason };
}
