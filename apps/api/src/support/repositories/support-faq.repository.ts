import { Injectable } from '@nestjs/common';
import type { SupportTicketCategory } from '@repo/shared/support';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

const supportFaqSelect = {
  id: true,
  category: true,
  question: true,
  answer: true,
} as const;

const supportFaqPlacementSelect = {
  article: {
    select: supportFaqSelect,
  },
} as const;

type SupportFaqPlacementRecord = Prisma.SupportFaqPlacementGetPayload<{
  select: typeof supportFaqPlacementSelect;
}>;

export type SupportFaqRecord = Readonly<{
  id: string;
  category: SupportTicketCategory;
  question: string;
  answer: string;
}>;

function toPlacementSupportFaqRecord(placement: SupportFaqPlacementRecord): SupportFaqRecord {
  return placement.article;
}

@Injectable()
export class SupportFaqRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedForSupportCenter(input: {
    category?: SupportTicketCategory | null;
  }): Promise<SupportFaqRecord[]> {
    const placements = await this.prisma.supportFaqPlacement.findMany({
      where: {
        surface: 'SUPPORT_CENTER',
        article: {
          published: true,
          ...(input.category ? { category: input.category } : {}),
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { articleId: 'asc' }],
      select: supportFaqPlacementSelect,
    });

    return placements.map(toPlacementSupportFaqRecord);
  }

  async findPublishedByIdForSupportCenter(id: string): Promise<SupportFaqRecord | null> {
    const placement = await this.prisma.supportFaqPlacement.findFirst({
      where: {
        articleId: id,
        surface: 'SUPPORT_CENTER',
        article: { published: true },
      },
      select: supportFaqPlacementSelect,
    });

    return placement ? toPlacementSupportFaqRecord(placement) : null;
  }
}
