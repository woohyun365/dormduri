import { z } from 'zod';
import { isoDateTimeStringSchema } from '../date/primitives.js';

export const bookmarkSortSchema = z.enum(['RECENT', 'MATCH_SCORE']);
export const BookmarkSort = bookmarkSortSchema.enum;

export const bookmarkEmptyStateCodeSchema = z.enum(['NO_BOOKMARKS', 'NO_VISIBLE_BOOKMARKS']);
export const BookmarkEmptyStateCode = bookmarkEmptyStateCodeSchema.enum;
export const NO_BOOKMARKS = BookmarkEmptyStateCode.NO_BOOKMARKS;
export const NO_VISIBLE_BOOKMARKS = BookmarkEmptyStateCode.NO_VISIBLE_BOOKMARKS;

export const bookmarkVisibilityStateSchema = z.enum(['VISIBLE', 'NO_LONGER_VISIBLE']);

export const createBookmarkRequestSchema = z.strictObject({
  targetUserId: z.string().trim().min(1).max(128),
});

export const deleteBookmarkRequestSchema = z.strictObject({
  targetUserId: z.string().trim().min(1).max(128),
});

export const listBookmarksQuerySchema = z.strictObject({
  sort: bookmarkSortSchema.optional().default(BookmarkSort.RECENT),
  cursor: z.string().trim().min(1).max(512).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const bookmarkListMetadataSchema = z.strictObject({
  sort: bookmarkSortSchema,
  serverTime: isoDateTimeStringSchema,
});

export const bookmarkPageInfoSchema = z.strictObject({
  hasNextPage: z.boolean(),
  nextCursor: z.string().min(1).nullable(),
});

export const bookmarkEmptyStateSchema = z.strictObject({
  code: bookmarkEmptyStateCodeSchema,
});

export const bookmarkProfileSummarySchema = z.strictObject({
  nickname: z.string().min(1),
  intro: z.string(),
  smokingBehavior: z.string().nullable(),
  sleepHabit: z.string().nullable(),
  relationshipStyle: z.string().nullable(),
});

export const bookmarkListItemSchema = z.strictObject({
  id: z.string().min(1),
  targetUserId: z.string().min(1),
  targetParticipantId: z.string().min(1),
  bookmarkedAt: isoDateTimeStringSchema,
  visibility: bookmarkVisibilityStateSchema,
  profileSummary: bookmarkProfileSummarySchema.nullable(),
  matchScore: z.number().min(0).max(100).nullable().optional(),
});

export const bookmarkSchema = z.strictObject({
  id: z.string().min(1),
  targetUserId: z.string().min(1),
  targetParticipantId: z.string().min(1),
  bookmarkedAt: isoDateTimeStringSchema,
});

export const createBookmarkResponseSchema = z.strictObject({
  bookmark: bookmarkSchema,
  created: z.boolean(),
  listMetadata: bookmarkListMetadataSchema,
});

export const deleteBookmarkResponseSchema = z.strictObject({
  deleted: z.boolean(),
  listMetadata: bookmarkListMetadataSchema,
});

export const bookmarkListResponseSchema = z.strictObject({
  items: z.array(bookmarkListItemSchema),
  pageInfo: bookmarkPageInfoSchema,
  emptyState: bookmarkEmptyStateSchema.nullable(),
  sort: bookmarkSortSchema,
  serverTime: isoDateTimeStringSchema,
});

export type BookmarkSort = z.infer<typeof bookmarkSortSchema>;
export type BookmarkEmptyStateCode = z.infer<typeof bookmarkEmptyStateCodeSchema>;
export type CreateBookmarkRequest = z.infer<typeof createBookmarkRequestSchema>;
export type DeleteBookmarkRequest = z.infer<typeof deleteBookmarkRequestSchema>;
export type ListBookmarksQuery = z.infer<typeof listBookmarksQuerySchema>;
export type BookmarkListMetadata = z.infer<typeof bookmarkListMetadataSchema>;
export type BookmarkListItem = z.infer<typeof bookmarkListItemSchema>;
export type BookmarkListResponse = z.infer<typeof bookmarkListResponseSchema>;
export type CreateBookmarkResponse = z.infer<typeof createBookmarkResponseSchema>;
export type DeleteBookmarkResponse = z.infer<typeof deleteBookmarkResponseSchema>;
