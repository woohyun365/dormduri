import type { CreateMatchRequestRequest } from '@repo/shared/match/contract';

export const MATCH_REQUEST_NOTE_MODERATION_PORT = Symbol('MATCH_REQUEST_NOTE_MODERATION_PORT');

export interface MatchRequestNoteModerationPort {
  moderateMatchRequestNote(note: CreateMatchRequestRequest['note']): Promise<string | null>;
}
