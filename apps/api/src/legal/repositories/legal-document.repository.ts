import { Injectable } from '@nestjs/common';
import type { LegalDocumentKind } from '@repo/shared/legal';
import type { Prisma } from '@repo/database/client';
import { PrismaService } from '../../platform/database/prisma.service.js';

export const legalDocumentVersionSelect = {
  id: true,
  kind: true,
  version: true,
  title: true,
  summaryItems: true,
  sections: true,
  changeSummary: true,
  noticeClass: true,
  consentRequired: true,
  effectiveDate: true,
  appliesUntil: true,
  publishedAt: true,
  withdrawnAt: true,
} as const;

export type LegalDocumentVersionRecord = Prisma.LegalDocumentVersionGetPayload<{
  select: typeof legalDocumentVersionSelect;
}>;

type LegalVersionReader = Pick<Prisma.TransactionClient, 'legalDocumentVersion'>;

/**
 * Published versions of the given kinds whose notice has started by `now`, withdrawn ones left out.
 * Version state (scheduled, current, previous) is computed from these rows and the same clock.
 */
export function findPublishedLegalVersions(
  client: LegalVersionReader,
  kinds: readonly LegalDocumentKind[],
  now: Date,
): Promise<LegalDocumentVersionRecord[]> {
  return client.legalDocumentVersion.findMany({
    where: { kind: { in: [...kinds] }, withdrawnAt: null, publishedAt: { lte: now } },
    orderBy: [{ kind: 'asc' }, { effectiveDate: 'asc' }],
    select: legalDocumentVersionSelect,
  });
}

@Injectable()
export class LegalDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  getDatabaseNow(): Promise<Date> {
    return this.prisma.getDatabaseNow();
  }

  listPublishedVersions(
    kinds: readonly LegalDocumentKind[],
    now: Date,
  ): Promise<LegalDocumentVersionRecord[]> {
    return findPublishedLegalVersions(this.prisma, kinds, now);
  }
}
