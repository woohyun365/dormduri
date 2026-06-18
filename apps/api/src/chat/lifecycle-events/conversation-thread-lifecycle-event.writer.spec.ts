import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ConversationThreadClosedReason,
  ConversationThreadKind,
  ConversationThreadLifecycleActorType,
  ConversationThreadLifecycleEventReason,
  ConversationThreadLifecycleEventType,
  ConversationThreadLifecycleSourceDomain,
  ConversationThreadStatus,
} from '../../generated/prisma/enums.js';
import { ConversationThreadLifecycleEventRepository } from './conversation-thread-lifecycle-event.repository.js';
import { ConversationThreadLifecycleEventWriter } from './conversation-thread-lifecycle-event.writer.js';
import type { ConversationThreadLifecycleEventCreateInput } from './conversation-thread-lifecycle-event.types.js';

const occurredAt = new Date('2026-02-10T03:00:00.000Z');
const tx = {} as Prisma.TransactionClient;

describe('ConversationThreadLifecycleEventWriter', () => {
  let create: Mock<
    (
      arg0: Prisma.TransactionClient,
      arg1: ConversationThreadLifecycleEventCreateInput,
    ) => Promise<unknown>
  >;
  let writer: ConversationThreadLifecycleEventWriter;

  beforeEach(() => {
    create =
      vi.fn<
        (
          arg0: Prisma.TransactionClient,
          arg1: ConversationThreadLifecycleEventCreateInput,
        ) => Promise<unknown>
      >();
    create.mockResolvedValue({ id: 'event-1' });
    writer = new ConversationThreadLifecycleEventWriter({
      create,
    } as unknown as ConversationThreadLifecycleEventRepository);
  });

  it('allowlist metadata를 sanitize해서 repository에 전달하고 actorType 기본값을 SYSTEM으로 둔다', async () => {
    await writer.append(tx, {
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
      sourceDomain: ConversationThreadLifecycleSourceDomain.SOCIAL_SAFETY,
      sourceBlockId: 'block-1',
      occurredAt,
      metadata: {
        previousStatus: ConversationThreadStatus.OPEN,
        nextStatus: ConversationThreadStatus.READ_ONLY,
        previousThreadKind: ConversationThreadKind.DIRECT,
        nextThreadKind: ConversationThreadKind.DIRECT,
        previousClosedReason: null,
        nextClosedReason: ConversationThreadClosedReason.USER_BLOCKED,
      },
    });

    expect(create).toHaveBeenCalledWith(tx, {
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_READ_ONLY,
      reason: ConversationThreadLifecycleEventReason.USER_BLOCKED,
      actorType: ConversationThreadLifecycleActorType.SYSTEM,
      sourceDomain: ConversationThreadLifecycleSourceDomain.SOCIAL_SAFETY,
      sourceBlockId: 'block-1',
      occurredAt,
      metadata: {
        previousStatus: ConversationThreadStatus.OPEN,
        nextStatus: ConversationThreadStatus.READ_ONLY,
        previousThreadKind: ConversationThreadKind.DIRECT,
        nextThreadKind: ConversationThreadKind.DIRECT,
        previousClosedReason: null,
        nextClosedReason: ConversationThreadClosedReason.USER_BLOCKED,
      },
    });
  });

  it('explicit actor와 source pointer columns를 metadata와 분리해서 전달한다', async () => {
    await writer.append(tx, {
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_REOPENED,
      reason: ConversationThreadLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
      actorType: ConversationThreadLifecycleActorType.USER,
      actorUserId: 'user-1',
      sourceDomain: ConversationThreadLifecycleSourceDomain.MATCHES,
      sourceMatchRequestId: 'match-request-1',
      metadata: {
        previousStatus: ConversationThreadStatus.READ_ONLY,
        nextStatus: ConversationThreadStatus.OPEN,
      },
    });

    expect(create).toHaveBeenCalledWith(tx, {
      threadId: 'thread-1',
      eventType: ConversationThreadLifecycleEventType.THREAD_REOPENED,
      reason: ConversationThreadLifecycleEventReason.MATCH_REQUEST_ACCEPTED,
      actorType: ConversationThreadLifecycleActorType.USER,
      actorUserId: 'user-1',
      sourceDomain: ConversationThreadLifecycleSourceDomain.MATCHES,
      sourceMatchRequestId: 'match-request-1',
      metadata: {
        previousStatus: ConversationThreadStatus.READ_ONLY,
        nextStatus: ConversationThreadStatus.OPEN,
      },
    });
  });

  it('forbidden metadata key는 reject하고 repository create를 호출하지 않는다', async () => {
    await expect(
      writer.append(tx, {
        threadId: 'thread-1',
        eventType: ConversationThreadLifecycleEventType.THREAD_ARCHIVED,
        reason: ConversationThreadLifecycleEventReason.MODERATION_ACTION,
        sourceDomain: ConversationThreadLifecycleSourceDomain.RETENTION,
        metadata: {
          previousStatus: ConversationThreadStatus.READ_ONLY,
          reportDetail: 'raw report detail must not be stored',
        },
      }),
    ).rejects.toThrow('forbidden');

    expect(create).not.toHaveBeenCalled();
  });

  it('unknown metadata key는 reject하고 repository create를 호출하지 않는다', async () => {
    await expect(
      writer.append(tx, {
        threadId: 'thread-1',
        eventType: ConversationThreadLifecycleEventType.THREAD_CREATED,
        reason: ConversationThreadLifecycleEventReason.DIRECT_MESSAGE_STARTED,
        sourceDomain: ConversationThreadLifecycleSourceDomain.CHAT,
        metadata: {
          previousStatus: null,
          rawDebugPayload: 'not allowed',
        },
      }),
    ).rejects.toThrow('not allowed');

    expect(create).not.toHaveBeenCalled();
  });
});
