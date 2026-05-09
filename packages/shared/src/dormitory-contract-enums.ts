import { z } from 'zod';

export const dormitorySelectionStateSchema = z.enum(['NOT_SELECTED', 'UNASSIGNED', 'ASSIGNED']);
export const dormitoryGenderPolicySchema = z.enum(['M', 'F', 'BOTH']);
export const dormitoryBathroomTypeSchema = z.enum(['SHARED', 'PRIVATE']);
export const dormitoryRoomTypeSchema = z.union([z.literal(2), z.literal(3)]);

export type DormitorySelectionState = z.infer<typeof dormitorySelectionStateSchema>;
export type DormitoryGenderPolicy = z.infer<typeof dormitoryGenderPolicySchema>;
export type DormitoryBathroomType = z.infer<typeof dormitoryBathroomTypeSchema>;
