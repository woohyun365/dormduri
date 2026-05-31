import { z } from 'zod';
import {
  dormitoryBathroomTypeSchema,
  dormitoryRoomTypeSchema,
} from './dormitory-contract-enums.js';

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

export type DormitoryGuidePayload = z.infer<typeof dormitoryGuidePayloadSchema>;
export type DormitoryGuideResponse = z.infer<typeof dormitoryGuideResponseSchema>;
