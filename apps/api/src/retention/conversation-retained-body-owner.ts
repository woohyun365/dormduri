import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { RetentionCipher } from './retention-cipher.js';
import {
  createRetentionVaultCipher,
  createStaticRetentionVaultKeyring,
  discloseRetainedVaultPayload,
  ensureRetentionCaseTx,
  retainVaultPayloadTx,
  type RetentionVaultKeyring,
} from './retained-vault-owner.js';

const CHAT_BODY_AAD_PREFIX = 'knu-roommate:chat-message-body:v1';

export const conversationMessageTombstoneText = {
  ACCOUNT_DELETION_RETENTION: '보존 처리된 메시지입니다.',
  USER_MESSAGE_DELETED: '삭제된 메시지입니다.',
  MODERATION_POLICY_VIOLATION: '이 메시지는 운영 원칙에 위배되어 삭제되었습니다.',
  ADMIN_ACTION: '운영자에 의해 삭제된 메시지입니다.',
  RETENTION_DISPOSED: '보존 기간이 만료되어 삭제된 메시지입니다.',
} as const;

type ConversationMessageTombstoneReason = keyof typeof conversationMessageTombstoneText;
type ConversationRetainedBodyAccessReason =
  | 'LAW_ENFORCEMENT_REQUEST'
  | 'REPORT_REVIEW'
  | 'DISPUTE_RESPONSE'
  | 'ENFORCEMENT_REVIEW'
  | 'SECURITY_AUDIT'
  | 'RETENTION_EXPIRY_REVIEW';

interface RetainedConversationBodyPlaintext {
  schemaVersion: 1;
  messageId: string;
  threadId: string;
  senderUserId: string;
  senderParticipantId: string;
  sentAt: string;
  body: string;
  bodyVersionAtRetention: number;
  retainedAt: string;
  tombstoneReason: ConversationMessageTombstoneReason;
}

export type ConversationRetainedBodyCipher = RetentionCipher;

export interface ConversationRetainedBodyOwnerOptions {
  keyring?: RetentionVaultKeyring;
  bodyCipher?: ConversationRetainedBodyCipher | null;
}

export interface RetainAndTombstoneThreadMessagesInput {
  threadId: string;
  archiveJobId?: string | null;
  triggerUserId?: string | null;
  triggerRetainedIdentityId?: string | null;
  now: Date;
  reason?: Extract<ConversationMessageTombstoneReason, 'ACCOUNT_DELETION_RETENTION'>;
  metadata?: Record<string, unknown>;
}

export interface TombstoneConversationMessageInput {
  messageId: string;
  reason: ConversationMessageTombstoneReason;
  now: Date;
  retainOriginalBody: boolean;
  archiveJobId?: string | null;
  triggerUserId?: string | null;
  triggerRetainedIdentityId?: string | null;
  retentionCaseId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessageTombstoneEventPayload {
  type: 'conversation.message.tombstoned';
  threadId: string;
  messageId: string;
  bodyState: 'TOMBSTONED';
  tombstoneReason: ConversationMessageTombstoneReason;
  body: string;
  occurredAt: string;
  bodyVersion: number;
}

export interface RetainAndTombstoneThreadMessagesResult {
  scannedCount: number;
  retainedCount: number;
  tombstonedCount: number;
  events: ConversationMessageTombstoneEventPayload[];
}

export interface ConversationRetainedBodyDisclosureInput {
  retainedVaultObjectId?: string;
  messageId?: string;
  accessedBy: string;
  accessReason: ConversationRetainedBodyAccessReason;
  approvalReference: string;
  purpose: string;
  now?: Date;
}

export interface ConversationRetainedBodyDisclosure {
  retainedVaultObjectId: string;
  messageId: string;
  threadId: string;
  body: string;
  keyVersion: string;
  disclosedAt: Date;
}

export function createConversationRetainedBodyOwner(
  options: ConversationRetainedBodyOwnerOptions = {},
) {
  return {
    retainAndTombstoneThreadMessagesTx(
      tx: Prisma.TransactionClient,
      input: RetainAndTombstoneThreadMessagesInput,
    ) {
      return retainAndTombstoneThreadMessagesTx(tx, input, options);
    },
    tombstoneConversationMessageTx(
      tx: Prisma.TransactionClient,
      input: TombstoneConversationMessageInput,
    ) {
      return tombstoneConversationMessageTx(tx, input, options);
    },
    discloseRetainedConversationMessageBody(
      prisma: Pick<PrismaService, 'retainedVaultObject' | 'retainedVaultAccessLog'>,
      input: ConversationRetainedBodyDisclosureInput,
    ) {
      return discloseRetainedConversationMessageBody(prisma, input, options);
    },
  };
}

export function createConversationRetainedBodyCipher(input: {
  key: string | Buffer;
  keyVersion: string;
}): ConversationRetainedBodyCipher {
  return createRetentionVaultCipher(input);
}

export async function retainAndTombstoneThreadMessagesTx(
  tx: Prisma.TransactionClient,
  input: RetainAndTombstoneThreadMessagesInput,
  options: ConversationRetainedBodyOwnerOptions = {},
): Promise<RetainAndTombstoneThreadMessagesResult> {
  const messages = await tx.conversationMessage.findMany({
    where: {
      threadId: input.threadId,
      bodyState: { in: ['PLAIN', 'TOMBSTONED'] },
    },
    select: {
      id: true,
      threadId: true,
      body: true,
      bodyState: true,
      tombstoneReason: true,
      bodyVersion: true,
      retainedVaultObjectId: true,
      senderParticipantId: true,
      sentAt: true,
      senderParticipant: { select: { userId: true } },
    },
    orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });

  const result: RetainAndTombstoneThreadMessagesResult = {
    scannedCount: messages.length,
    retainedCount: 0,
    tombstonedCount: 0,
    events: [],
  };

  const reason = input.reason ?? 'ACCOUNT_DELETION_RETENTION';
  const retentionCase = await ensureRetentionCaseTx(tx, {
    reason: 'CHAT_THREAD_ARCHIVE',
    triggerUserId: input.triggerUserId,
    triggerRetainedIdentityId: input.triggerRetainedIdentityId,
    sourceTable: 'ConversationThread',
    sourceId: input.threadId,
    metadata: input.metadata ?? null,
  });

  for (const message of messages) {
    if (message.bodyState !== 'PLAIN') {
      continue;
    }

    const event = await tombstoneConversationMessageTx(
      tx,
      {
        messageId: message.id,
        reason,
        now: input.now,
        retainOriginalBody: true,
        archiveJobId: input.archiveJobId,
        triggerUserId: input.triggerUserId,
        triggerRetainedIdentityId: input.triggerRetainedIdentityId,
        retentionCaseId: retentionCase.id,
        metadata: input.metadata,
      },
      options,
    );
    result.retainedCount += 1;
    result.tombstonedCount += 1;
    result.events.push(event);
  }

  return result;
}

export async function tombstoneConversationMessageTx(
  tx: Prisma.TransactionClient,
  input: TombstoneConversationMessageInput,
  options: ConversationRetainedBodyOwnerOptions = {},
): Promise<ConversationMessageTombstoneEventPayload> {
  const message = await tx.conversationMessage.findUnique({
    where: { id: input.messageId },
    select: {
      id: true,
      threadId: true,
      body: true,
      bodyState: true,
      tombstoneReason: true,
      bodyVersion: true,
      retainedVaultObjectId: true,
      senderParticipantId: true,
      sentAt: true,
      senderParticipant: { select: { userId: true } },
    },
  });

  if (!message) {
    throw new Error('[conversation-retained-body-owner] message not found');
  }

  if (message.bodyState === 'DISPOSED') {
    throw new Error('[conversation-retained-body-owner] disposed message cannot be tombstoned');
  }

  if (message.bodyState === 'TOMBSTONED') {
    return {
      type: 'conversation.message.tombstoned',
      threadId: message.threadId,
      messageId: message.id,
      bodyState: 'TOMBSTONED',
      tombstoneReason: message.tombstoneReason ?? input.reason,
      body: message.body,
      occurredAt: input.now.toISOString(),
      bodyVersion: message.bodyVersion,
    };
  }

  let retainedVaultObjectId = message.retainedVaultObjectId;
  if (input.retainOriginalBody && message.bodyState === 'PLAIN' && !retainedVaultObjectId) {
    const retentionCaseId =
      input.retentionCaseId ??
      (
        await ensureRetentionCaseTx(tx, {
          reason: 'CHAT_THREAD_ARCHIVE',
          triggerUserId: input.triggerUserId,
          triggerRetainedIdentityId: input.triggerRetainedIdentityId,
          sourceTable: 'ConversationThread',
          sourceId: message.threadId,
          metadata: input.metadata ?? null,
        })
      ).id;

    const retained = await retainVaultPayloadTx(
      tx,
      {
        target: 'CHAT_MESSAGE_BODY',
        sourceTable: 'ConversationMessage',
        sourceId: message.id,
        archiveJobId: input.archiveJobId,
        subjectUserId: message.senderParticipant.userId,
        subjectRetainedIdentityId:
          input.triggerUserId && input.triggerUserId === message.senderParticipant.userId
            ? input.triggerRetainedIdentityId
            : null,
        subjectParticipantId: message.senderParticipantId,
        subjectRole: 'MESSAGE_SENDER',
        keyPurpose: 'CHAT_BODY',
        payloadSchemaVersion: 1,
        plaintext: {
          schemaVersion: 1,
          messageId: message.id,
          threadId: message.threadId,
          senderUserId: message.senderParticipant.userId,
          senderParticipantId: message.senderParticipantId,
          sentAt: message.sentAt.toISOString(),
          body: message.body,
          bodyVersionAtRetention: message.bodyVersion,
          retainedAt: input.now.toISOString(),
          tombstoneReason: input.reason,
        } satisfies RetainedConversationBodyPlaintext,
        aad: buildChatBodyAad(message.id),
        retainedAt: input.now,
        metadata: input.metadata,
        retentionCaseId,
        holdReason: 'CHAT_THREAD_ARCHIVE',
        holdUntil: null,
      },
      { keyring: resolveConversationKeyring(options) },
    );
    retainedVaultObjectId = retained.id;
  }

  const tombstoneBody = conversationMessageTombstoneText[input.reason];
  const updated = await tx.conversationMessage.update({
    where: { id: message.id },
    data: {
      body: tombstoneBody,
      bodyState: 'TOMBSTONED',
      tombstoneReason: input.reason,
      tombstonedAt: input.now,
      bodyRetainedAt: input.retainOriginalBody ? input.now : undefined,
      retainedVaultObjectId: retainedVaultObjectId ?? undefined,
      bodyVersion: { increment: 1 },
    },
    select: {
      id: true,
      threadId: true,
      body: true,
      bodyVersion: true,
    },
  });

  return {
    type: 'conversation.message.tombstoned',
    threadId: updated.threadId,
    messageId: updated.id,
    bodyState: 'TOMBSTONED',
    tombstoneReason: input.reason,
    body: updated.body,
    occurredAt: input.now.toISOString(),
    bodyVersion: updated.bodyVersion,
  };
}

export async function discloseRetainedConversationMessageBody(
  prisma: Pick<PrismaService, 'retainedVaultObject' | 'retainedVaultAccessLog'>,
  input: ConversationRetainedBodyDisclosureInput,
  options: ConversationRetainedBodyOwnerOptions = {},
): Promise<ConversationRetainedBodyDisclosure> {
  const disclosure = await discloseRetainedVaultPayload(
    prisma,
    {
      retainedVaultObjectId: input.retainedVaultObjectId,
      target: input.messageId ? 'CHAT_MESSAGE_BODY' : undefined,
      sourceId: input.messageId,
      subjectRole: input.messageId ? 'MESSAGE_SENDER' : undefined,
      accessedBy: input.accessedBy,
      accessReason: input.accessReason,
      approvalReference: input.approvalReference,
      purpose: input.purpose,
      now: input.now,
      parsePlaintext: parseRetainedConversationBodyPlaintext,
    },
    { keyring: resolveConversationKeyring(options) },
  );

  return {
    retainedVaultObjectId: disclosure.retainedVaultObjectId,
    messageId: disclosure.payload.messageId,
    threadId: disclosure.payload.threadId,
    body: disclosure.payload.body,
    keyVersion: disclosure.keyVersion,
    disclosedAt: disclosure.disclosedAt,
  };
}

export function parseRetainedConversationBodyPlaintext(
  payload: unknown,
): RetainedConversationBodyPlaintext {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[conversation-retained-body-owner] retained body plaintext invalid');
  }

  const candidate = payload as Partial<Record<keyof RetainedConversationBodyPlaintext, unknown>>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.messageId !== 'string' ||
    typeof candidate.threadId !== 'string' ||
    typeof candidate.senderUserId !== 'string' ||
    typeof candidate.senderParticipantId !== 'string' ||
    typeof candidate.sentAt !== 'string' ||
    typeof candidate.body !== 'string' ||
    typeof candidate.bodyVersionAtRetention !== 'number' ||
    typeof candidate.retainedAt !== 'string' ||
    typeof candidate.tombstoneReason !== 'string'
  ) {
    throw new Error('[conversation-retained-body-owner] retained body plaintext invalid');
  }

  return candidate as RetainedConversationBodyPlaintext;
}

function resolveConversationKeyring(options: ConversationRetainedBodyOwnerOptions) {
  if (options.keyring) {
    return options.keyring;
  }
  if (options.bodyCipher !== undefined) {
    return createStaticRetentionVaultKeyring({ CHAT_BODY: options.bodyCipher });
  }
  return undefined;
}

function buildChatBodyAad(messageId: string) {
  return `${CHAT_BODY_AAD_PREFIX}:${messageId}`;
}
