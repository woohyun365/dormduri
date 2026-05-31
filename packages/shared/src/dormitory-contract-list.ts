import { z } from 'zod';
import { campusMetaSchema } from './campus-contract.js';
import { campusSchema } from './identity-contract.js';
import {
  dormitoryGenderPolicySchema,
  dormitoryRoomTypeSchema,
} from './dormitory-contract-enums.js';

export const dormitoryItemSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  roomType: dormitoryRoomTypeSchema,
  genderPolicy: dormitoryGenderPolicySchema,
  isOperated: z.boolean(),
});

export const dormitoryListResponseSchema = z.strictObject({
  campus: campusMetaSchema,
  items: z.array(dormitoryItemSchema),
});

export const dormitoryDetailResponseSchema = z.strictObject({
  id: z.string(),
  campusCode: campusSchema,
  campusNameKo: z.string(),
  name: z.string(),
  roomType: dormitoryRoomTypeSchema,
  genderPolicy: dormitoryGenderPolicySchema,
  isOperated: z.boolean(),
});

export type DormitoryItem = z.infer<typeof dormitoryItemSchema>;
export type DormitoryListResponse = z.infer<typeof dormitoryListResponseSchema>;
export type DormitoryDetailResponse = z.infer<typeof dormitoryDetailResponseSchema>;
