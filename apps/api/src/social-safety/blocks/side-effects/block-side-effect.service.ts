import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import {
  CHAT_BLOCK_SIDE_EFFECT_PORT,
  type ChatBlockSideEffectPort,
  type ChatBlockSideEffectResult,
} from '../../../chat/application/ports/chat-block-side-effect.port.js';
import {
  MATCH_BLOCK_SIDE_EFFECT_PORT,
  type MatchBlockSideEffectPort,
  type MatchBlockSideEffectResult,
} from '../../../matches/application/ports/match-block-side-effect.port.js';
import { BookmarkRepository } from '../../bookmarks/repositories/bookmark.repository.js';

export interface BlockSideEffectResult {
  removedBookmarkCount: number;
  match: MatchBlockSideEffectResult;
  chat: ChatBlockSideEffectResult;
}

@Injectable()
export class BlockSideEffectService {
  constructor(
    private readonly bookmarkRepository: BookmarkRepository,
    @Inject(MATCH_BLOCK_SIDE_EFFECT_PORT)
    private readonly matchBlockSideEffectPort: MatchBlockSideEffectPort,
    @Inject(CHAT_BLOCK_SIDE_EFFECT_PORT)
    private readonly chatBlockSideEffectPort: ChatBlockSideEffectPort,
  ) {}

  async applyBlockCreated(input: {
    tx: Prisma.TransactionClient;
    seasonId: string;
    blockerUserId: string;
    blockedUserId: string;
    sourceBlockId: string;
    now: Date;
  }): Promise<BlockSideEffectResult> {
    const removedBookmarkCount = await this.bookmarkRepository.softDeleteActiveBetweenUsers({
      client: input.tx,
      firstUserId: input.blockerUserId,
      secondUserId: input.blockedUserId,
      now: input.now,
    });
    const match = await this.matchBlockSideEffectPort.cancelPendingRequestsForBlock(input.tx, {
      seasonId: input.seasonId,
      blockerUserId: input.blockerUserId,
      blockedUserId: input.blockedUserId,
      occurredAt: input.now,
    });
    const chat = await this.chatBlockSideEffectPort.closeDirectThreadsForBlock(input.tx, {
      seasonId: input.seasonId,
      blockerUserId: input.blockerUserId,
      blockedUserId: input.blockedUserId,
      sourceBlockId: input.sourceBlockId,
      occurredAt: input.now,
    });

    return { removedBookmarkCount, match, chat };
  }
}
