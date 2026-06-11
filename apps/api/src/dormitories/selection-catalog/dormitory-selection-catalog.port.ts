import type { SelectableDormitory } from '@repo/shared/season/participation';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Campus, Gender } from '../../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';

export const DORMITORY_SELECTION_CATALOG_PORT = Symbol('DORMITORY_SELECTION_CATALOG_PORT');

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

export interface DormitorySelectionCatalogPort {
  listSelectableDormitoriesForSeasonParticipant(
    input: SeasonParticipantDormitorySelectionInput,
  ): Promise<SelectableDormitory[]>;

  validateSelectableDormitoryForSeasonParticipant(
    input: SeasonParticipantDormitoryValidationInput,
  ): Promise<DormitorySelectionValidationResult>;
}
