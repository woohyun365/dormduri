import { z } from 'zod';

export const conversationThreadKindSchema = z.enum(['DIRECT', 'MATCHED']);
export const conversationThreadStatusSchema = z.enum(['OPEN', 'READ_ONLY', 'ARCHIVED']);
export const conversationThreadClosedReasonSchema = z.enum([
  'ACTIVE_MATCH_CREATED',
  'ROOM_SELECTION_CUTOFF',
  'SEASON_ENDED',
  'PARTICIPANT_WITHDRAWN',
  'MODERATION',
  'ADMIN_ACTION',
]);

export type ConversationThreadKind = z.infer<typeof conversationThreadKindSchema>;
export type ConversationThreadStatus = z.infer<typeof conversationThreadStatusSchema>;
export type ConversationThreadClosedReason = z.infer<typeof conversationThreadClosedReasonSchema>;
