import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';

export const blockRecordSelect = {
  id: true,
  blockerUserId: true,
  blockedUserId: true,
  note: true,
  blockedAt: true,
  unblockedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const blockListRecordSelect = {
  ...blockRecordSelect,
  blockedUser: {
    select: {
      id: true,
      deletedAt: true,
      displayIdentity: {
        select: {
          nickname: true,
        },
      },
    },
  },
} as const;

export type BlockRecord = Prisma.UserBlockGetPayload<{
  select: typeof blockRecordSelect;
}>;

export type BlockListRecord = Prisma.UserBlockGetPayload<{
  select: typeof blockListRecordSelect;
}>;

export type BlockRepositoryClient = Pick<Prisma.TransactionClient, 'userBlock' | 'userBlockEvent'>;

@Injectable()
export class BlockRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveBetween(input: {
    client?: BlockRepositoryClient;
    blockerUserId: string;
    blockedUserId: string;
  }): Promise<BlockRecord | null> {
    const client = input.client ?? this.prisma;
    return client.userBlock.findFirst({
      where: {
        blockerUserId: input.blockerUserId,
        blockedUserId: input.blockedUserId,
        unblockedAt: null,
      },
      select: blockRecordSelect,
    });
  }

  create(input: {
    client: BlockRepositoryClient;
    blockerUserId: string;
    blockedUserId: string;
    note: string | null;
    now: Date;
  }): Promise<BlockRecord> {
    return input.client.userBlock.create({
      data: {
        blockerUserId: input.blockerUserId,
        blockedUserId: input.blockedUserId,
        note: input.note,
        blockedAt: input.now,
      },
      select: blockRecordSelect,
    });
  }

  async appendBlockedEvent(input: {
    client: BlockRepositoryClient;
    block: Pick<BlockRecord, 'id' | 'blockerUserId' | 'blockedUserId' | 'note'>;
    now: Date;
  }): Promise<void> {
    await input.client.userBlockEvent.create({
      data: {
        blockId: input.block.id,
        actorUserId: input.block.blockerUserId,
        targetUserId: input.block.blockedUserId,
        eventType: 'BLOCKED',
        noteSnapshot: input.block.note,
        occurredAt: input.now,
      },
    });
  }

  async markUnblocked(input: {
    client: BlockRepositoryClient;
    blockId: string;
    now: Date;
  }): Promise<BlockRecord> {
    return input.client.userBlock.update({
      where: { id: input.blockId },
      data: { unblockedAt: input.now },
      select: blockRecordSelect,
    });
  }

  async appendUnblockedEvent(input: {
    client: BlockRepositoryClient;
    block: Pick<BlockRecord, 'id' | 'blockerUserId' | 'blockedUserId' | 'note'>;
    now: Date;
  }): Promise<void> {
    await input.client.userBlockEvent.create({
      data: {
        blockId: input.block.id,
        actorUserId: input.block.blockerUserId,
        targetUserId: input.block.blockedUserId,
        eventType: 'UNBLOCKED',
        noteSnapshot: input.block.note,
        occurredAt: input.now,
      },
    });
  }

  countActiveForBlocker(input: { blockerUserId: string }): Promise<number> {
    return this.prisma.userBlock.count({
      where: {
        blockerUserId: input.blockerUserId,
        unblockedAt: null,
      },
    });
  }

  findActiveForBlocker(input: {
    blockerUserId: string;
    limit: number;
    cursor?: { blockedAt: Date; id: string } | null;
  }): Promise<BlockListRecord[]> {
    return this.prisma.userBlock.findMany({
      where: {
        blockerUserId: input.blockerUserId,
        unblockedAt: null,
        ...(input.cursor
          ? {
              OR: [
                { blockedAt: { lt: input.cursor.blockedAt } },
                {
                  blockedAt: input.cursor.blockedAt,
                  id: { lt: input.cursor.id },
                },
              ],
            }
          : {}),
      },
      select: blockListRecordSelect,
      orderBy: [{ blockedAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });
  }
}
