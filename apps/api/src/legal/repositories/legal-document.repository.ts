import { Injectable } from '@nestjs/common';
import type { LegalDocumentKind as SharedLegalDocumentKind } from '@repo/shared/legal';
import type { Prisma } from '../../generated/prisma/client.js';
import type { LegalDocumentKind as PrismaLegalDocumentKind } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

export const legalDocumentVersionSelect = {
  id: true,
  kind: true,
  version: true,
  title: true,
  summaryItems: true,
  sections: true,
  changeSummary: true,
  publishedAt: true,
  effectiveAt: true,
  retiredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type LegalDocumentVersionRecord = Prisma.LegalDocumentVersionGetPayload<{
  select: typeof legalDocumentVersionSelect;
}>;

function toPrismaLegalDocumentKind(kind: SharedLegalDocumentKind): PrismaLegalDocumentKind {
  return kind;
}

@Injectable()
export class LegalDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  getDatabaseNow(): Promise<Date> {
    return this.prisma.getDatabaseNow();
  }

  findActiveByKind(
    kind: SharedLegalDocumentKind,
    now: Date,
  ): Promise<LegalDocumentVersionRecord | null> {
    return this.prisma.legalDocumentVersion.findFirst({
      where: {
        kind: toPrismaLegalDocumentKind(kind),
        publishedAt: { not: null, lte: now },
        effectiveAt: { lte: now },
        OR: [{ retiredAt: null }, { retiredAt: { gt: now } }],
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      select: legalDocumentVersionSelect,
    });
  }
}
