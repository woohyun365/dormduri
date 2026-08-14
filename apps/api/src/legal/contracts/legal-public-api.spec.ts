import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  LegalDocumentKind,
  legalDocumentResponseSchema,
  type LegalDocumentKind as LegalDocumentKindValue,
} from '@repo/shared/legal';
import { LegalDocumentQuery } from '../queries/legal-document.query.js';
import {
  LegalDocumentRepository,
  legalDocumentVersionSelect,
  type LegalDocumentVersionRecord,
} from '../repositories/legal-document.repository.js';
import { toLegalDocumentResponse } from '../presenters/legal-document.presenter.js';

const now = new Date('2026-06-22T00:00:00.000Z');

function legalRecord(
  kind: LegalDocumentKindValue = LegalDocumentKind.TERMS_OF_SERVICE,
): LegalDocumentVersionRecord {
  return {
    id: `${kind.toLowerCase()}-2026-06-22`,
    kind,
    version: `${kind.toLowerCase()}-2026-06-22`,
    title: `${kind} 문서`,
    effectiveAt: now,
    publishedAt: now,
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
    summaryItems: ['공개 legal document summary'],
    sections: [{ type: 'paragraph', text: '공개 legal document body' }],
    changeSummary: '최초 공개 버전입니다.',
  };
}

describe('legal public API contract', () => {
  it('repository는 published/effective/retired 조건과 최신 active ordering으로 조회한다', async () => {
    const prisma = {
      legalDocumentVersion: {
        findFirst: vi.fn().mockResolvedValue(legalRecord()),
      },
    };
    const repository = new LegalDocumentRepository(prisma as never);

    await repository.findActiveByKind(LegalDocumentKind.TERMS_OF_SERVICE, now);

    expect(prisma.legalDocumentVersion.findFirst).toHaveBeenCalledWith({
      where: {
        kind: LegalDocumentKind.TERMS_OF_SERVICE,
        publishedAt: { not: null, lte: now },
        effectiveAt: { lte: now },
        OR: [{ retiredAt: null }, { retiredAt: { gt: now } }],
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      select: legalDocumentVersionSelect,
    });
  });

  it('presenter는 public allowlist만 내려주고 internal DB field를 제거한다', () => {
    const response = toLegalDocumentResponse(legalRecord(LegalDocumentKind.PRIVACY_POLICY));

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
    expect('publishedAt' in response).toBe(false);
    expect('retiredAt' in response).toBe(false);
    expect('createdAt' in response).toBe(false);
  });

  it('query는 active document가 없으면 not found로 fail-closed 처리한다', async () => {
    const repository = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      findActiveByKind: vi.fn().mockResolvedValue(null),
    } as unknown as LegalDocumentRepository;
    const query = new LegalDocumentQuery(repository);

    await expect(query.getActive(LegalDocumentKind.PRIVACY_POLICY)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('bundle query는 네 종류의 active document를 모두 요구한다', async () => {
    const records = new Map<LegalDocumentKindValue, LegalDocumentVersionRecord>([
      [LegalDocumentKind.TERMS_OF_SERVICE, legalRecord(LegalDocumentKind.TERMS_OF_SERVICE)],
      [LegalDocumentKind.PRIVACY_POLICY, legalRecord(LegalDocumentKind.PRIVACY_POLICY)],
      [
        LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
        legalRecord(LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT),
      ],
      [
        LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE,
        legalRecord(LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE),
      ],
    ]);
    const findActiveByKind = vi.fn((kind: LegalDocumentKindValue) =>
      Promise.resolve(records.get(kind)),
    );
    const repository = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      findActiveByKind,
    } as unknown as LegalDocumentRepository;
    const query = new LegalDocumentQuery(repository);

    await expect(query.getActiveBundle()).resolves.toMatchObject({
      termsOfService: { kind: LegalDocumentKind.TERMS_OF_SERVICE },
      privacyPolicy: { kind: LegalDocumentKind.PRIVACY_POLICY },
      personalDataCollectionUseConsent: {
        kind: LegalDocumentKind.PERSONAL_DATA_COLLECTION_USE_CONSENT,
      },
      age14OrAboveNotice: { kind: LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE },
    });
    expect(findActiveByKind).toHaveBeenCalledTimes(4);
  });

  it('bundle query는 active document가 하나라도 없으면 partial success를 만들지 않는다', async () => {
    const repository = {
      getDatabaseNow: vi.fn().mockResolvedValue(now),
      findActiveByKind: vi.fn((kind: LegalDocumentKindValue) =>
        Promise.resolve(
          kind === LegalDocumentKind.AGE_14_OR_ABOVE_NOTICE ? null : legalRecord(kind),
        ),
      ),
    } as unknown as LegalDocumentRepository;
    const query = new LegalDocumentQuery(repository);

    await expect(query.getActiveBundle()).rejects.toBeInstanceOf(HttpException);
    await expect(query.getActiveBundle()).rejects.toMatchObject({ status: 500 });
  });
});
