import { Injectable } from '@nestjs/common';
import type { ListGlobalNoticesQuery, NoticeSeverity } from '@repo/shared/notices';
import { Prisma } from '../../generated/prisma/client.js';
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

@Injectable()
export class GlobalNoticeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(input: {
    query: ListGlobalNoticesQuery;
    after?: GlobalNoticeCursorBoundary;
  }): Promise<GlobalNoticeRecord[]> {
    const now = await this.prisma.getDatabaseNow();
    const where = buildPublishedNoticeWhereSql({
      now,
      severity: input.query.severity ?? null,
      relatedSeasonId: input.query.relatedSeasonId ?? null,
      after: input.after,
    });
    const take = input.query.limit + 1;

    return this.prisma.$queryRaw<GlobalNoticeRecord[]>(Prisma.sql`
      SELECT
        "id",
        "title",
        "summary",
        "body",
        "severity",
        "relatedSeasonId",
        "publishedAt",
        "expiresAt",
        "createdAt",
        "updatedAt"
      FROM "GlobalNotice"
      WHERE ${where}
      ORDER BY "publishedAt" DESC, "id" DESC
      LIMIT ${take}
    `);
  }

  async findPublishedById(noticeId: string): Promise<GlobalNoticeRecord | null> {
    const now = await this.prisma.getDatabaseNow();
    const rows = await this.prisma.$queryRaw<GlobalNoticeRecord[]>(Prisma.sql`
      SELECT
        "id",
        "title",
        "summary",
        "body",
        "severity",
        "relatedSeasonId",
        "publishedAt",
        "expiresAt",
        "createdAt",
        "updatedAt"
      FROM "GlobalNotice"
      WHERE
        "id" = ${noticeId}
        AND "publishedAt" IS NOT NULL
        AND "publishedAt" <= ${now}
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      LIMIT 1
    `);

    return rows[0] ?? null;
  }
}

export function buildPublishedNoticeWhereSql(input: {
  now: Date;
  severity?: NoticeSeverity | null;
  relatedSeasonId?: string | null;
  after?: GlobalNoticeCursorBoundary;
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"publishedAt" IS NOT NULL`,
    Prisma.sql`"publishedAt" <= ${input.now}`,
    Prisma.sql`("expiresAt" IS NULL OR "expiresAt" > ${input.now})`,
  ];

  if (input.severity) {
    conditions.push(Prisma.sql`"severity" = ${input.severity}`);
  }

  if (input.relatedSeasonId) {
    conditions.push(Prisma.sql`"relatedSeasonId" = ${input.relatedSeasonId}`);
  }

  if (input.after) {
    conditions.push(
      Prisma.sql`("publishedAt", "id") < (${input.after.publishedAt}, ${input.after.noticeId})`,
    );
  }

  return Prisma.join(conditions, ' AND ');
}
