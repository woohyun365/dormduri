import { Injectable } from '@nestjs/common';
import type { ListGlobalNoticesQuery, NoticeSeverity } from '@repo/shared/notices';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

export type GlobalNoticeRecord = Readonly<{
  id: string;
  title: string;
  summary: string;
  body: string;
  severity: string;
  relatedSeasonId: string | null;
  publishedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type GlobalNoticeCursorBoundary = Readonly<{
  publishedAt: Date;
  noticeId: string;
}>;

const globalNoticeSelect = {
  id: true,
  title: true,
  summary: true,
  body: true,
  severity: true,
  relatedSeasonId: true,
  publishedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GlobalNoticeSelect;

type GlobalNoticePersistenceRow = Prisma.GlobalNoticeGetPayload<{
  select: typeof globalNoticeSelect;
}>;

@Injectable()
export class GlobalNoticeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(input: {
    query: ListGlobalNoticesQuery;
    after?: GlobalNoticeCursorBoundary;
  }): Promise<GlobalNoticeRecord[]> {
    const now = await this.prisma.getDatabaseNow();
    const where = buildPublishedNoticeWhere({
      now,
      severity: input.query.severity ?? null,
      relatedSeasonId: input.query.relatedSeasonId ?? null,
      after: input.after,
    });
    const take = input.query.limit + 1;

    const rows = await this.prisma.globalNotice.findMany({
      where,
      select: globalNoticeSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take,
    });

    return rows.map(toPublishedNoticeRecord);
  }

  async findPublishedById(noticeId: string): Promise<GlobalNoticeRecord | null> {
    const now = await this.prisma.getDatabaseNow();
    const row = await this.prisma.globalNotice.findFirst({
      where: {
        id: noticeId,
        AND: [buildPublishedNoticeWhere({ now })],
      },
      select: globalNoticeSelect,
    });

    return row ? toPublishedNoticeRecord(row) : null;
  }
}

export function buildPublishedNoticeWhere(input: {
  now: Date;
  severity?: NoticeSeverity | null;
  relatedSeasonId?: string | null;
  after?: GlobalNoticeCursorBoundary;
}): Prisma.GlobalNoticeWhereInput {
  const conditions: Prisma.GlobalNoticeWhereInput[] = [
    {
      publishedAt: {
        not: null,
        lte: input.now,
      },
    },
    {
      OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }],
    },
  ];

  if (input.severity) {
    conditions.push({ severity: input.severity });
  }

  if (input.relatedSeasonId) {
    conditions.push({ relatedSeasonId: input.relatedSeasonId });
  }

  if (input.after) {
    conditions.push({
      OR: [
        { publishedAt: { lt: input.after.publishedAt } },
        {
          publishedAt: input.after.publishedAt,
          id: { lt: input.after.noticeId },
        },
      ],
    });
  }

  return { AND: conditions };
}

function toPublishedNoticeRecord(row: GlobalNoticePersistenceRow): GlobalNoticeRecord {
  if (!row.publishedAt) {
    throw new Error('Published global notice row must include publishedAt.');
  }

  return {
    ...row,
    publishedAt: row.publishedAt,
  };
}
