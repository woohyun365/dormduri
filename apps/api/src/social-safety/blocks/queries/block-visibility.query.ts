import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { BlockVisibilityReaderPort } from '../application/ports/block-visibility-reader.port.js';

@Injectable()
export class BlockVisibilityQuery implements BlockVisibilityReaderPort {
  constructor(private readonly prisma: PrismaService) {}

  async getExcludedTargetUserIds(input: {
    viewerUserId: string;
    targetUserIds: readonly string[];
  }): Promise<ReadonlySet<string>> {
    const targetUserIds = [...new Set(input.targetUserIds)];
    if (targetUserIds.length === 0) {
      return new Set();
    }

    const activeBlocks = await this.prisma.userBlock.findMany({
      where: {
        unblockedAt: null,
        OR: [
          {
            blockerUserId: input.viewerUserId,
            blockedUserId: { in: targetUserIds },
          },
          {
            blockerUserId: { in: targetUserIds },
            blockedUserId: input.viewerUserId,
          },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });

    return new Set(
      activeBlocks.map((block) =>
        block.blockerUserId === input.viewerUserId ? block.blockedUserId : block.blockerUserId,
      ),
    );
  }
}
