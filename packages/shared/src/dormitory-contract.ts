import { z } from 'zod';
import { campusMetaSchema } from './campus-contract.js';
import { campusSchema } from './auth-contract.js';

export const UNASSIGNED_DORMITORY_ID = 'unassigned' as const;

export const dormitorySelectionStateSchema = z.enum(['NOT_SELECTED', 'UNASSIGNED', 'ASSIGNED']);
export const dormitoryGenderPolicySchema = z.enum(['M', 'F', 'BOTH']);
export const dormitoryBathroomTypeSchema = z.enum(['SHARED', 'PRIVATE']);
export const dormitoryRoomTypeSchema = z.union([z.literal(2), z.literal(3)]);

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

export const dormitoryCommonRuleSchema = z.strictObject({
  emoji: z.string(),
  label: z.string(),
  value: z.string(),
});

export const dormitoryContactSchema = z.strictObject({
  label: z.string(),
  value: z.string(),
});

export const dormitoryGuidePayloadSchema = z.strictObject({
  bathroomType: dormitoryBathroomTypeSchema,
  facilities: z.array(z.string()),
  repairContact: z.string(),
  diningContact: z.string().nullable(),
});

export const dormitoryGuideResponseSchema = z.strictObject({
  dormitory: z.strictObject({
    id: z.string(),
    name: z.string(),
    roomType: dormitoryRoomTypeSchema,
  }),
  guide: dormitoryGuidePayloadSchema,
  commonRules: z.array(dormitoryCommonRuleSchema),
  emergencyContacts: z.array(dormitoryContactSchema),
  homepageUrl: z.string().url(),
});

export type DormitorySelectionState = z.infer<typeof dormitorySelectionStateSchema>;
export type DormitoryGenderPolicy = z.infer<typeof dormitoryGenderPolicySchema>;
export type DormitoryBathroomType = z.infer<typeof dormitoryBathroomTypeSchema>;
export type DormitoryItem = z.infer<typeof dormitoryItemSchema>;
export type DormitoryListResponse = z.infer<typeof dormitoryListResponseSchema>;
export type DormitoryDetailResponse = z.infer<typeof dormitoryDetailResponseSchema>;
export type DormitoryGuidePayload = z.infer<typeof dormitoryGuidePayloadSchema>;
export type DormitoryGuideResponse = z.infer<typeof dormitoryGuideResponseSchema>;
