import { z } from 'zod';
import { dormitoryGenderPolicySchema, dormitoryRoomTypeSchema } from '../../dormitory/enums.js';
import { campusSchema } from '../../identity-contract.js';
import { localDateStringSchema } from '../../date-primitives.js';
import { seasonStateSchema } from '../primitives.js';
import { seasonParticipationCompletionStateSchema, seasonProfileStateSchema } from './state.js';

export const selectableDormitorySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  campusCode: campusSchema,
  roomType: dormitoryRoomTypeSchema,
  genderPolicy: dormitoryGenderPolicySchema,
  roomSelectionDate: localDateStringSchema,
});

export const selectableDormitoriesResponseSchema = z.strictObject({
  seasonId: z.string(),
  seasonState: seasonStateSchema,
  profileState: seasonProfileStateSchema,
  completion: seasonParticipationCompletionStateSchema,
  items: z.array(selectableDormitorySchema),
});

export const selectedDormitorySubmitRequestSchema = z.strictObject({
  dormitoryId: z.string(),
});

export const dormitorySelectionDraftResponseSchema = z.strictObject({
  seasonId: z.string(),
  participantId: z.string(),
  dormitorySelectionState: z.literal('SELECTED'),
  dormitoryId: z.string(),
  profileState: seasonProfileStateSchema,
  completion: seasonParticipationCompletionStateSchema,
});

export type SelectableDormitory = z.infer<typeof selectableDormitorySchema>;
export type SelectableDormitoriesResponse = z.infer<typeof selectableDormitoriesResponseSchema>;
export type SelectedDormitorySubmitRequest = z.infer<typeof selectedDormitorySubmitRequestSchema>;
export type DormitorySelectionDraftResponse = z.infer<typeof dormitorySelectionDraftResponseSchema>;
