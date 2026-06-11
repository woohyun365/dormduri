import type { Prisma } from '../../../generated/prisma/client.js';

export const CHAT_REPORT_TARGET_CONTEXT_PORT = Symbol('CHAT_REPORT_TARGET_CONTEXT_PORT');

export type ChatReportTargetClient = Pick<
  Prisma.TransactionClient,
  'conversationThread' | 'conversationMessage'
>;

export interface ChatReportThreadTargetContext {
  threadId: string;
  seasonId: string;
  counterpartUserId: string;
  counterpartParticipantId: string;
  participantAId: string;
  participantBId: string;
  threadKind: string;
  status: 'OPEN' | 'READ_ONLY';
  closedReason: string | null;
}

export interface ChatReportMessageTargetContext {
  messageId: string;
  threadId: string;
  seasonId: string;
  senderUserId: string;
  senderParticipantId: string;
  participantAId: string;
  participantBId: string;
  bodyState: string;
  tombstoneReason: string | null;
}

export interface ChatReportTargetContextPort {
  resolveThreadTarget(input: {
    actorParticipantId: string;
    seasonId: string;
    threadId: string;
    client?: ChatReportTargetClient;
  }): Promise<ChatReportThreadTargetContext | null>;

  resolveMessageTarget(input: {
    actorParticipantId: string;
    seasonId: string;
    messageId: string;
    client?: ChatReportTargetClient;
  }): Promise<ChatReportMessageTargetContext | null>;
}
