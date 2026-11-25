import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  LegalDocumentKind,
  legalDocumentResponseSchema,
  type LegalDocumentKind as LegalDocumentKindValue,
} from '@repo/shared/legal';
import { legalTimelineOf, type LegalVersion } from '../domain/legal-version.js';
import { LegalDocumentQuery } from '../queries/legal-document.query.js';
import type {
  LegalPublishedRead,
  LegalPublishedVersionReader,
} from '../queries/legal-published-version.reader.js';
import {
  LegalDocumentRepository,
  legalDocumentVersionSelect,
} from '../repositories/legal-document.repository.js';
import { toLegalDocumentResponse } from '../presenters/legal-document.presenter.js';

const now = new Date('2026-06-22T00:00:00.000Z');

function legalVersion(
  kind: LegalDocumentKindValue = LegalDocumentKind.TERMS_OF_SERVICE,
): LegalVersion {
  return {
    id: `${kind.toLowerCase()}-2026-06-22`,
    kind,
    version: `${kind.toLowerCase()}-2026-06-22`,
    title: `${kind} 문서`,
    summaryItems: ['공개 legal document summary'],
    sections: [{ type: 'paragraph', text: '공개 legal document body' }],
    changeSummary: '최초 공개 버전입니다.',
    noticeClass: 'INITIAL',
    consentRequired: false,
    effectiveDate: '2026-06-22',
    appliesUntil: null,
    publishedAt: new Date('2026-06-21T15:00:00.000Z'),
    withdrawnAt: null,
  };
}

function readerOf(versionsByKind: Map<LegalDocumentKindValue, LegalVersion[]>) {
  const read: LegalPublishedRead = {
    endpoint: 'active',
    source: 'database',
    versionsOf: (kind) => versionsByKind.get(kind) ?? [],
    nowOf: () => now,
  };
  return {
    read: vi.fn().mockResolvedValue(read),
    record: vi.fn(),
  } as unknown as LegalPublishedVersionReader;
}

describe('legal public API contract', () => {
  it('repository는 공지가 시작되고 철회되지 않은 판만 kind·시행일 순으로 읽는다', async () => {
    const prisma = {
      getDatabaseNow: vi.fn(),
      legalDocumentVersion: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new LegalDocumentRepository(prisma as never);

    await repository.listPublishedVersions([LegalDocumentKind.TERMS_OF_SERVICE], now);

    expect(prisma.legalDocumentVersion.findMany).toHaveBeenCalledWith({
      where: {
        kind: { in: [LegalDocumentKind.TERMS_OF_SERVICE] },
        withdrawnAt: null,
        publishedAt: { lte: now },
      },
      orderBy: [{ kind: 'asc' }, { effectiveDate: 'asc' }],
      select: legalDocumentVersionSelect,
    });
    // Approval and digest columns are not read for public reading.
    for (const column of [
      'contentDigest',
      'authorAdminAccountId',
      'approverAdminAccountId',
      'selfApproved',
      'createdAt',
      'updatedAt',
    ]) {
      expect(column in legalDocumentVersionSelect, column).toBe(false);
    }
  });

  it('presenter는 public allowlist만 내려주고 internal DB field를 제거한다', () => {
    const [entry] = legalTimelineOf([legalVersion(LegalDocumentKind.PRIVACY_POLICY)], now);
    const response = toLegalDocumentResponse(entry!);

    expect(legalDocumentResponseSchema.parse(response)).toMatchObject({
      kind: LegalDocumentKind.PRIVACY_POLICY,
    });
    expect(Object.keys(response).sort()).toEqual(
      [
        'changeSummary',
        'effectiveAt',
        'id',
        'kind',
        'lastModifiedAt',
        'sections',
        'summaryItems',
        'title',
        'version',
      ].sort(),
    );
    for (const internal of ['publishedAt', 'withdrawnAt', 'noticeClass', 'consentRequired']) {
      expect(internal in response, internal).toBe(false);
    }
  });

  it('query는 시행 중 판이 없으면 not found로 fail-closed 처리한다', async () => {
    const query = new LegalDocumentQuery(readerOf(new Map()));

    await expect(query.getActive(LegalDocumentKind.PRIVACY_POLICY)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('bundle query는 네 종류의 시행 중 판을 모두 요구한다', async () => {
    const versions = new Map(
      [
        LegalDocumentKind.TERMS_OF_SERVICE,
        LegalDocumentKind.PRIVACY_POLICY,
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
      ].map((kind) => [kind, [legalVersion(kind)]]),
    );
    const query = new LegalDocumentQuery(readerOf(versions));

    await expect(query.getActiveBundle()).resolves.toMatchObject({
      termsOfService: { kind: LegalDocumentKind.TERMS_OF_SERVICE },
      privacyPolicy: { kind: LegalDocumentKind.PRIVACY_POLICY },
      personalDataCollectionUseConsent: {
        kind: LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
      },
      age14OrAboveNotice: { kind: LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE },
    });
  });

  it('bundle query는 시행 중 판이 하나라도 없으면 partial success를 만들지 않는다', async () => {
    const versions = new Map(
      [
        LegalDocumentKind.TERMS_OF_SERVICE,
        LegalDocumentKind.PRIVACY_POLICY,
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
      ].map((kind) => [kind, [legalVersion(kind)]]),
    );
    const query = new LegalDocumentQuery(readerOf(versions));

    await expect(query.getActiveBundle()).rejects.toBeInstanceOf(HttpException);
    await expect(query.getActiveBundle()).rejects.toMatchObject({ status: 500 });
  });
});
