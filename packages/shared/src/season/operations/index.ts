import { z } from 'zod';
import { isoDateTimeStringSchema, localDateStringSchema } from '../../date/primitives.js';
import { campusSchema } from '../../identity/primitives.js';
import {
  seasonRuntimeOverrideSchema,
  seasonStateSchema,
  seasonSummarySchema,
} from '../runtime/primitives.js';

const expectedUpdatedAtSchema = isoDateTimeStringSchema;
const operationReasonSchema = z.string().trim().min(1).max(500);

export const updateSeasonScheduleRequestSchema = z.strictObject({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  name: z.string().trim().min(1).max(120).optional(),
  preparationStartDate: localDateStringSchema,
  matchingStartDate: localDateStringSchema,
  seasonEndDate: localDateStringSchema,
  reason: operationReasonSchema.optional(),
});

export const updateSeasonOverrideRequestSchema = z.strictObject({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  state: seasonStateSchema,
  reason: operationReasonSchema,
  startsAt: isoDateTimeStringSchema.nullable().optional(),
  endsAt: isoDateTimeStringSchema.nullable().optional(),
});

export const clearSeasonOverrideRequestSchema = z.strictObject({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  reason: operationReasonSchema.optional(),
});

export const seasonOperationAuditActionSchema = z.enum([
  'UPDATE_SCHEDULE',
  'UPDATE_OVERRIDE',
  'CLEAR_OVERRIDE',
]);

export const seasonOperationsSeasonSnapshotSchema = z.strictObject({
  campusCode: campusSchema,
  season: seasonSummarySchema,
  updatedAt: isoDateTimeStringSchema,
  override: seasonRuntimeOverrideSchema,
});

export const seasonOperationResponseSchema = z.strictObject({
  season: seasonOperationsSeasonSnapshotSchema,
  auditEventId: z.string(),
  action: seasonOperationAuditActionSchema,
});

export type UpdateSeasonScheduleRequest = z.infer<typeof updateSeasonScheduleRequestSchema>;
export type UpdateSeasonOverrideRequest = z.infer<typeof updateSeasonOverrideRequestSchema>;
export type ClearSeasonOverrideRequest = z.infer<typeof clearSeasonOverrideRequestSchema>;
export type SeasonOperationAuditAction = z.infer<typeof seasonOperationAuditActionSchema>;
export type SeasonOperationsSeasonSnapshot = z.infer<typeof seasonOperationsSeasonSnapshotSchema>;
export type SeasonOperationResponse = z.infer<typeof seasonOperationResponseSchema>;
