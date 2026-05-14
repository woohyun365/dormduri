import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  createRetentionCipher,
  decryptJsonPayload,
  encryptJsonPayload,
  type EncryptedRetentionPayload,
  type RetentionCipher,
} from './retention-cipher.js';

const CHAT_BODY_KEY_ENV = 'RETENTION_CHAT_BODY_ENCRYPTION_KEY_BASE64';
const CHAT_BODY_KEY_VERSION_ENV = 'RETENTION_CHAT_BODY_KEY_VERSION';
const DEFAULT_CHAT_BODY_KEY_VERSION = 'local-v1';
const CHAT_BODY_AAD = Buffer.from('knu-roommate:conversation-message-body:v1');

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
  | 'SECURITY_AUDIT'
  | 'RETENTION_EXPIRY_REVIEW';

interface RetainedConversationBodyPlaintext {
  schemaVersion: 1;
  messageId: string;
  threadId: string;
  body: string;
  retainedAt: string;
}

type EncryptedConversationBodyPayload = EncryptedRetentionPayload;

export type ConversationRetainedBodyCipher = RetentionCipher;

export interface ConversationRetainedBodyOwnerOptions {
  bodyCipher?: ConversationRetainedBodyCipher | null;
}

export interface RetainAndTombstoneThreadMessagesInput {
  threadId: string;
  archiveJobId?: string | null;
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
  triggerRetainedIdentityId?: string | null;
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
  retainedBodyId?: string;
  messageId?: string;
  accessedBy: string;
  accessReason: ConversationRetainedBodyAccessReason;
  approvalReference: string;
  purpose: string;
  now?: Date;
}

export interface ConversationRetainedBodyDisclosure {
  retainedBodyId: string;
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
      prisma: Pick<
        PrismaService,
        'conversationMessageRetainedBody' | 'conversationMessageRetainedBodyAccessLog'
      >,
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
  return createRetentionCipher({
    key: input.key,
    keyVersion: input.keyVersion,
    errorPrefix: '[conversation-retained-body-owner]',
  });
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
      retainedBody: { select: { id: true } },
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
        triggerRetainedIdentityId: input.triggerRetainedIdentityId,
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
      retainedBody: { select: { id: true } },
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

  if (input.retainOriginalBody && message.bodyState === 'PLAIN' && !message.retainedBody) {
    const cipher = resolveConversationRetainedBodyCipher(options.bodyCipher);
    if (!cipher) {
      throw new Error('[conversation-retained-body-owner] retained body key unavailable');
    }

    await tx.conversationMessageRetainedBody.upsert({
      where: { messageId: message.id },
      update: {
        archiveJobId: input.archiveJobId ?? undefined,
        triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? undefined,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
      create: {
        messageId: message.id,
        threadId: message.threadId,
        archiveJobId: input.archiveJobId ?? undefined,
        triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? undefined,
        encryptedBodyPayload: encryptConversationBodyPayload(cipher, {
          schemaVersion: 1,
          messageId: message.id,
          threadId: message.threadId,
          body: message.body,
          retainedAt: input.now.toISOString(),
        }) as unknown as Prisma.InputJsonValue,
        bodyDigest: hashText(message.body),
        keyVersion: cipher.keyVersion,
        retainedAt: input.now,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
      },
    });
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
  prisma: Pick<
    PrismaService,
    'conversationMessageRetainedBody' | 'conversationMessageRetainedBodyAccessLog'
  >,
  input: ConversationRetainedBodyDisclosureInput,
  options: ConversationRetainedBodyOwnerOptions = {},
): Promise<ConversationRetainedBodyDisclosure> {
  assertDisclosureInput(input);
  const now = input.now ?? new Date();
  const where = input.retainedBodyId
    ? { id: input.retainedBodyId }
    : input.messageId
      ? { messageId: input.messageId }
      : null;

  if (!where) {
    throw new Error('[conversation-retained-body-owner] retainedBodyId or messageId is required');
  }

  const retainedBody = await prisma.conversationMessageRetainedBody.findUnique({
    where,
    select: {
      id: true,
      messageId: true,
      threadId: true,
      encryptedBodyPayload: true,
      disposedAt: true,
    },
  });

  if (!retainedBody) {
    throw new Error('[conversation-retained-body-owner] retained body not found');
  }

  const logBase = {
    retainedBodyId: retainedBody.id,
    threadId: retainedBody.threadId,
    messageId: retainedBody.messageId,
    accessedBy: input.accessedBy,
    accessReason: input.accessReason,
    approvalReference: input.approvalReference,
    purpose: input.purpose,
  };

  if (retainedBody.disposedAt) {
    await createRetainedBodyAccessLog(prisma, {
      ...logBase,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[conversation-retained-body-owner] retained body disposed');
  }

  const cipher = resolveConversationRetainedBodyCipher(options.bodyCipher);
  if (!cipher) {
    await createRetainedBodyAccessLog(prisma, {
      ...logBase,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[conversation-retained-body-owner] retained body disclosure key unavailable');
  }

  try {
    const plaintext = decryptConversationBodyPayload(cipher, retainedBody.encryptedBodyPayload);
    await createRetainedBodyAccessLog(prisma, {
      ...logBase,
      result: 'DISCLOSED',
      disclosedFields: ['body'],
    });

    return {
      retainedBodyId: retainedBody.id,
      messageId: retainedBody.messageId,
      threadId: retainedBody.threadId,
      body: plaintext.body,
      keyVersion: cipher.keyVersion,
      disclosedAt: now,
    };
  } catch (error) {
    await createRetainedBodyAccessLog(prisma, {
      ...logBase,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw error;
  }
}

export function encryptConversationBodyPayload(
  cipher: ConversationRetainedBodyCipher,
  plaintext: RetainedConversationBodyPlaintext,
): EncryptedConversationBodyPayload {
  return encryptJsonPayload({ cipher, plaintext, aad: CHAT_BODY_AAD });
}

export function decryptConversationBodyPayload(
  cipher: ConversationRetainedBodyCipher,
  payload: unknown,
): RetainedConversationBodyPlaintext {
  return decryptJsonPayload({
    cipher,
    payload,
    aad: CHAT_BODY_AAD,
    errorPrefix: '[conversation-retained-body-owner] retained body',
    parsePlaintext: parseRetainedConversationBodyPlaintext,
  });
}

function resolveConversationRetainedBodyCipher(
  cipherOverride: ConversationRetainedBodyCipher | null | undefined,
): ConversationRetainedBodyCipher | null {
  if (cipherOverride !== undefined) {
    return cipherOverride;
  }

  const rawKey = process.env[CHAT_BODY_KEY_ENV]?.trim();
  if (!rawKey) {
    return null;
  }

  return createConversationRetainedBodyCipher({
    key: rawKey,
    keyVersion: process.env[CHAT_BODY_KEY_VERSION_ENV]?.trim() || DEFAULT_CHAT_BODY_KEY_VERSION,
  });
}

async function createRetainedBodyAccessLog(
  prisma: Pick<PrismaService, 'conversationMessageRetainedBodyAccessLog'>,
  input: {
    retainedBodyId: string;
    threadId: string;
    messageId: string;
    accessedBy: string;
    accessReason: ConversationRetainedBodyAccessReason;
    approvalReference: string;
    purpose: string;
    result: 'DISCLOSED' | 'DENIED' | 'DISPOSED';
    disclosedFields: string[];
  },
) {
  await prisma.conversationMessageRetainedBodyAccessLog.create({
    data: {
      retainedBodyId: input.retainedBodyId,
      threadId: input.threadId,
      messageId: input.messageId,
      accessedBy: input.accessedBy,
      accessReason: input.accessReason,
      approvalReference: input.approvalReference,
      purpose: input.purpose,
      result: input.result,
      disclosedFields: input.disclosedFields as Prisma.InputJsonValue,
    },
  });
}

function assertDisclosureInput(input: ConversationRetainedBodyDisclosureInput) {
  if (!input.accessedBy.trim()) {
    throw new Error('[conversation-retained-body-owner] accessedBy is required');
  }
  if (!input.approvalReference.trim()) {
    throw new Error('[conversation-retained-body-owner] approvalReference is required');
  }
  if (!input.purpose.trim()) {
    throw new Error('[conversation-retained-body-owner] purpose is required');
  }
}

function parseRetainedConversationBodyPlaintext(
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
    typeof candidate.body !== 'string' ||
    typeof candidate.retainedAt !== 'string'
  ) {
    throw new Error('[conversation-retained-body-owner] retained body plaintext invalid');
  }

  return candidate as RetainedConversationBodyPlaintext;
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
