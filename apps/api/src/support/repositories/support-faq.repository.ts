import { Injectable } from '@nestjs/common';
import type { SupportTicketCategory } from '@repo/shared/support';
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

export type SupportFaqRecord = Prisma.SupportFaqArticleGetPayload<{
  select: typeof supportFaqSelect;
}>;

@Injectable()
export class SupportFaqRepository {
  constructor(private readonly prisma: PrismaService) {}

  listPublished(input: { category?: SupportTicketCategory | null }): Promise<SupportFaqRecord[]> {
    return this.prisma.supportFaqArticle.findMany({
      where: {
        published: true,
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: supportFaqSelect,
    });
  }

  findPublishedById(id: string): Promise<SupportFaqRecord | null> {
    return this.prisma.supportFaqArticle.findFirst({
      where: { id, published: true },
      select: supportFaqSelect,
    });
  }
}
