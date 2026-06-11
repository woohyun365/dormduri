import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../platform/database/prisma.service.js';

@Injectable()
export class ChatSubscriptionQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async canSubscribeThreadForViewer(userId: string, threadId: string): Promise<boolean> {
    const count = await this.prisma.conversationThread.count({
      where: {
        id: threadId,
        status: { in: ['OPEN', 'READ_ONLY'] },
        members: {
          some: {
            memberState: 'ACTIVE',
            participant: {
              userId,
              hiddenByAdminAt: null,
              deactivatedAt: null,
              user: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return count > 0;
  }
}
