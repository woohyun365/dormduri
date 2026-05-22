import { Injectable } from '@nestjs/common';
import type { SelectableDormitory } from '@repo/shared/season-contract';
import { toDateOnlyString } from '@repo/shared/date-primitives';
import type { Prisma } from '../generated/prisma/client.js';
import type { Campus, DormitoryGenderPolicy, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { formatKstDate } from '../seasons/season.utils.js';

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

export type DormitorySelectionQueryClient = Pick<
  Prisma.TransactionClient,
  'seasonDormitoryOperation'
>;

export type DormitorySelectionValidationReason =
  | 'DORMITORY_NOT_FOUND'
  | 'DORMITORY_NOT_OPERATED'
  | 'DORMITORY_CAMPUS_MISMATCH'
  | 'DORMITORY_GENDER_MISMATCH'
  | 'DORMITORY_SELECTION_CLOSED';

export type DormitorySelectionValidationResult =
  | { valid: true; item: SelectableDormitory }
  | { valid: false; reason: DormitorySelectionValidationReason };

export interface SeasonParticipantDormitorySelectionInput {
  seasonContext: CurrentSeasonContext;
  campusCodeSnapshot: Campus;
  genderSnapshot: Gender;
  now: Date;
  queryClient?: DormitorySelectionQueryClient;
}

export interface SeasonParticipantDormitoryValidationInput extends SeasonParticipantDormitorySelectionInput {
  dormitoryId: string;
}

@Injectable()
export class DormitorySelectableQueryService {
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
    if (!isGenderCompatible(input.genderSnapshot, operation.dormitory.genderPolicy)) {
      return invalidDormitorySelection('DORMITORY_GENDER_MISMATCH');
    }
    if (isRoomSelectionClosed(input.seasonContext, operation.roomSelectionDate, input.now)) {
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

function mapSeasonParticipantSelectableDormitory(
  operation: SeasonDormitoryOperationRecord,
): SelectableDormitory {
  return {
    id: operation.dormitory.id,
    name: operation.dormitory.nameKo,
    campusCode: operation.dormitory.campusCode,
    roomType: operation.dormitory.roomType as 2 | 3,
    genderPolicy: operation.dormitory.genderPolicy,
    roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
  };
}

function invalidDormitorySelection(
  reason: DormitorySelectionValidationReason,
): DormitorySelectionValidationResult {
  return { valid: false, reason };
}

function isGenderCompatible(gender: Gender, genderPolicy: DormitoryGenderPolicy) {
  return genderPolicy === 'BOTH' || genderPolicy === gender;
}

function isRoomSelectionClosed(
  seasonContext: CurrentSeasonContext,
  roomSelectionDate: Date,
  now: Date,
) {
  return (
    seasonContext.state === 'SEASON_MATCHING' &&
    formatKstDate(now) > toDateOnlyString(roomSelectionDate)
  );
}
