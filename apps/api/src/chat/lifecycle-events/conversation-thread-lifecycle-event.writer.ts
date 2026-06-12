import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { ConversationThreadLifecycleActorType } from '../../generated/prisma/enums.js';
import { toConversationThreadLifecycleEventMetadata } from './conversation-thread-lifecycle-event.payload.policy.js';
import { ConversationThreadLifecycleEventRepository } from './conversation-thread-lifecycle-event.repository.js';
import type { ConversationThreadLifecycleEventAppendInput } from './conversation-thread-lifecycle-event.types.js';

export interface ConversationThreadLifecycleEventAppender {
  append(
    tx: Prisma.TransactionClient,
    input: ConversationThreadLifecycleEventAppendInput,
  ): Promise<unknown>;
}

export const noopConversationThreadLifecycleEventAppender: ConversationThreadLifecycleEventAppender =
  {
    append() {
      return Promise.resolve(null);
    },
  };

@Injectable()
export class ConversationThreadLifecycleEventWriter implements ConversationThreadLifecycleEventAppender {
  constructor(private readonly repository: ConversationThreadLifecycleEventRepository) {}

  async append(tx: Prisma.TransactionClient, input: ConversationThreadLifecycleEventAppendInput) {
    return this.repository.create(tx, {
      ...input,
      actorType: input.actorType ?? ConversationThreadLifecycleActorType.SYSTEM,
      metadata: toConversationThreadLifecycleEventMetadata(input.metadata),
    });
  }
}
