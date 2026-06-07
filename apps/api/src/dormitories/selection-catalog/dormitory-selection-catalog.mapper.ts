import { toDateOnlyString } from '@repo/shared/date-primitives';
import type { SelectableDormitory } from '@repo/shared/season/participation';
import type { Campus, DormitoryGenderPolicy } from '../../generated/prisma/enums.js';

export interface DormitorySelectionCatalogRecord {
  dormitory: {
    id: string;
    campusCode: Campus;
    nameKo: string;
    roomType: number;
    genderPolicy: DormitoryGenderPolicy;
  };
  roomSelectionDate: Date;
}

export function mapSeasonParticipantSelectableDormitory(
  operation: DormitorySelectionCatalogRecord,
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
