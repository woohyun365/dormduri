import { Injectable } from '@nestjs/common';
import type { SupportFaqSurface, SupportTicketCategory } from '@repo/shared/support';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

export const supportFaqSelect = {
  id: true,
  category: true,
  question: true,
  answer: true,
  published: true,
  sortOrder: true,
  updatedAt: true,
} as const;

const supportFaqPlacementSelect = {
  sortOrder: true,
  article: {
    select: supportFaqSelect,
  },
} as const;

type SupportFaqArticleRecord = Prisma.SupportFaqArticleGetPayload<{
  select: typeof supportFaqSelect;
}>;

type SupportFaqPlacementRecord = Prisma.SupportFaqPlacementGetPayload<{
  select: typeof supportFaqPlacementSelect;
}>;

export type SupportFaqRecord = Readonly<{
  id: string;
  category: SupportTicketCategory;
  question: string;
  answer: string;
  published: boolean;
  sortOrder: number;
  updatedAt: Date;
}>;

function toSupportFaqRecord(article: SupportFaqArticleRecord): SupportFaqRecord {
  return article;
}

function toPlacementSupportFaqRecord(placement: SupportFaqPlacementRecord): SupportFaqRecord {
  return {
    ...placement.article,
    sortOrder: placement.sortOrder,
  };
}

@Injectable()
export class SupportFaqRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(input: {
    category?: SupportTicketCategory | null;
  }): Promise<SupportFaqRecord[]> {
    const records = await this.prisma.supportFaqArticle.findMany({
      where: {
        published: true,
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: supportFaqSelect,
    });

    return records.map(toSupportFaqRecord);
  }

  async listPublishedForSurface(input: {
    surface: SupportFaqSurface;
    category?: SupportTicketCategory | null;
  }): Promise<SupportFaqRecord[]> {
    const placements = await this.prisma.supportFaqPlacement.findMany({
      where: {
        surface: input.surface,
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

  async findPublishedById(id: string): Promise<SupportFaqRecord | null> {
    const record = await this.prisma.supportFaqArticle.findFirst({
      where: { id, published: true },
      select: supportFaqSelect,
    });

    return record ? toSupportFaqRecord(record) : null;
  }
}
