import { z } from 'zod';
import { campusMetaSchema } from '../campus/index.js';
import { campusSchema } from '../identity/primitives.js';
import { dormitoryGenderPolicySchema, dormitoryRoomTypeSchema } from './enums.js';

export const dormitoryPublicSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  roomType: dormitoryRoomTypeSchema,
  genderPolicy: dormitoryGenderPolicySchema,
});

export const dormitoryItemSchema = z.strictObject({
  ...dormitoryPublicSummarySchema.shape,
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
export type DormitoryPublicSummary = z.infer<typeof dormitoryPublicSummarySchema>;
export type DormitoryListResponse = z.infer<typeof dormitoryListResponseSchema>;
export type DormitoryDetailResponse = z.infer<typeof dormitoryDetailResponseSchema>;
