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

export const conversationMessageBodyStateSchema = z.enum(['PLAIN', 'TOMBSTONED', 'DISPOSED']);
export const conversationMessageTombstoneReasonSchema = z.enum([
  'ACCOUNT_DELETION_RETENTION',
  'USER_MESSAGE_DELETED',
  'MODERATION_POLICY_VIOLATION',
  'ADMIN_ACTION',
  'RETENTION_DISPOSED',
]);

export type ConversationThreadKind = z.infer<typeof conversationThreadKindSchema>;
export type ConversationThreadStatus = z.infer<typeof conversationThreadStatusSchema>;
export type ConversationThreadClosedReason = z.infer<typeof conversationThreadClosedReasonSchema>;
export type ConversationMessageBodyState = z.infer<typeof conversationMessageBodyStateSchema>;
export type ConversationMessageTombstoneReason = z.infer<
  typeof conversationMessageTombstoneReasonSchema
>;
