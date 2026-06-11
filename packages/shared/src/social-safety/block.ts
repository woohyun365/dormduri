import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const BLOCK_NOTE_MAX_LENGTH = 500;

export const blockEmptyStateCodeSchema = z.enum(['NO_BLOCKS']);
export const BlockEmptyStateCode = blockEmptyStateCodeSchema.enum;
export const NO_BLOCKS = BlockEmptyStateCode.NO_BLOCKS;

export const blockVisibilityStateSchema = z.enum(['VISIBLE', 'NO_LONGER_VISIBLE']);

export const blockNoteSchema = z.string().trim().max(BLOCK_NOTE_MAX_LENGTH);

export const createBlockRequestSchema = z.strictObject({
  note: blockNoteSchema.optional().nullable(),
});

export const deleteBlockRequestSchema = z.strictObject({});

export const listBlocksQuerySchema = z.strictObject({
  cursor: z.string().trim().min(1).max(512).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const blockListMetadataSchema = z.strictObject({
  serverTime: isoDateTimeStringSchema,
});

export const blockPageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: z.string().min(1).nullable(),
});

export const blockEmptyStateSchema = z.strictObject({
  code: blockEmptyStateCodeSchema,
});

export const blockListItemSchema = z.strictObject({
  id: z.string().min(1),
  blockedUserId: z.string().min(1),
  blockedAt: isoDateTimeStringSchema,
  note: blockNoteSchema.nullable(),
  visibility: blockVisibilityStateSchema,
  displayName: z.string().min(1).nullable(),
});

export const blockSchema = z.strictObject({
  id: z.string().min(1),
  blockedUserId: z.string().min(1),
  blockedAt: isoDateTimeStringSchema,
  note: blockNoteSchema.nullable(),
});

export const createBlockResponseSchema = z.strictObject({
  block: blockSchema,
  created: z.boolean(),
  listMetadata: blockListMetadataSchema,
});

export const deleteBlockResponseSchema = z.strictObject({
  deleted: z.boolean(),
  listMetadata: blockListMetadataSchema,
});

export const blockListResponseSchema = z.strictObject({
  items: z.array(blockListItemSchema),
  pageInfo: blockPageInfoSchema,
  emptyState: blockEmptyStateSchema.nullable(),
  serverTime: isoDateTimeStringSchema,
});

export type BlockEmptyStateCode = z.infer<typeof blockEmptyStateCodeSchema>;
export type CreateBlockRequest = z.infer<typeof createBlockRequestSchema>;
export type DeleteBlockRequest = z.infer<typeof deleteBlockRequestSchema>;
export type ListBlocksQuery = z.infer<typeof listBlocksQuerySchema>;
export type BlockListMetadata = z.infer<typeof blockListMetadataSchema>;
export type BlockListItem = z.infer<typeof blockListItemSchema>;
export type BlockListResponse = z.infer<typeof blockListResponseSchema>;
export type CreateBlockResponse = z.infer<typeof createBlockResponseSchema>;
export type DeleteBlockResponse = z.infer<typeof deleteBlockResponseSchema>;
